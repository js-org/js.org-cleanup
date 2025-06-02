import { URL } from 'node:url';

import chalk from 'chalk';
import { Octokit } from '@octokit/rest';

import { log } from '../util/log.js';
import { getCache, setCache } from './cache.js';
import config from '../../config.json' with { type: 'json' };

const octokit = new Octokit();

/**
 * Fetches the raw cnames_active file from the configured repository
 * @returns {Promise<string>}
 */
export const getCNAMEsFile = async () => {
    // Log
    log('\nStarting getCNAMEsFile process', chalk.cyanBright.bold);

    // Get the raw GitHub API data
    const req = await octokit.rest.repos.getContent({
        owner: config.repository_owner,
        repo: config.repository_name,
        path: 'cnames_active.js'
    });

    // Get the contents of the file
    const content = Buffer.from(req.data.content, req.data.encoding).toString();

    // Done
    log('Fetching completed for getCNAMEsFile', chalk.greenBright.bold);
    return content;
};

/**
 * Test a given URL and provides a string with the error
 * @param {string} url - The URL to test
 * @returns {Promise<?string>} - The failure error message (or undefined if successful)
 */
const testUrl = async url => {
    const resp = await fetch(url, {
        headers: { 'User-Agent': 'js.org-cleanup/1.0' },
        signal: AbortSignal.timeout(5000),
    }).catch(err => {
        if (err.name === 'AbortError') return { err: 'Failed due to time out after 5s' };
        return { err: `Failed during request with error '${err}'` };
    });
    if (resp.err) return resp.err;
    if (!resp.ok) return `Failed with status code '${resp.status} ${resp.statusText}'`;

    // Only allow redirects within js.org
    const origin = new URL(resp.url).origin;
    if (resp.redirected && origin !== 'https://js.org' && !origin.endsWith('.js.org')) {
        return `Failed due to automatic redirect to '${resp.url}'`;
    }

    // Check we have HTML content
    const contentType = resp.headers.get('content-type');
    if (!contentType || !/(^|;)\s*text\/html(;|$)/i.test(contentType)) {
        return `Failed with content type '${contentType}' (status '${resp.status} ${resp.statusText}')`;
    }

    // Check we have some content
    const text = await resp.text();
    if (text.toLowerCase().trim() === '') {
        return `Failed with empty return body (status '${resp.status} ${resp.statusText}')`;
    }

    // Check we didn't get the JS.org 302 page
    const subdomain = url.replace(/^https?:\/\//, '').replace(/\.js\.org$/, '');
    if (text.includes(`<title>302 ${subdomain} - JS.ORG</title>`)) {
        return `Failed with JS.org 302 page (status '${resp.status} ${resp.statusText}')`;
    }

    // Check for a meta refresh tag
    const refresh = text.match(/<meta\s+http-equiv=["']refresh["']\s+content=["']\d+;\s*url=(.+?);?\s*["']/i);
    if (refresh) {
        try {
            const redirectUrl = new URL(refresh[1], url);
            if (!redirectUrl.origin.endsWith('.js.org')) {
                return `Failed with meta refresh to '${redirectUrl.href}' (status '${resp.status} ${resp.statusText}')`;
            }
        } catch {
            // Ignore any invalid URLs
        }
    }
};

/**
 * Validates each CNAME entry using a HTTP & HTTPS test
 * @param {import('../util/types.js').cnamesObject} cnames - Every entry to test
 * @returns {Promise<import('../util/types.js').cnamesValidationObject>} - The results of the validation ({failed, passed})
 */
export const validateCNAMEs = async (cnames) => {
    // Log
    log('\nStarting validateCNAMEs process', chalk.cyanBright.bold);

    // Fetch any cache we have
    const cache = getCache('validateCNAMEs');

    // DEV: only test the first few
    if (config.dev_restrict_cname_count) {
        const slice = Object.keys(cnames).slice(10);
        for (const key in slice) {
            delete cnames[slice[key]];
        }
    }

    // Test each entry
    const tests = {};
    let counter = 0;
    let failedCounter = 0;
    const totalLength = Object.keys(cnames).length;
    for (const cname in cnames) {
        if (!cnames.hasOwnProperty(cname)) continue;

        // Set position info
        counter++;
        const position = `${counter.toLocaleString()}/${totalLength.toLocaleString()} ${Math.round(counter / totalLength * 100).toLocaleString()}% (Failures: ${failedCounter.toLocaleString()} ${Math.round(failedCounter / totalLength * 100).toLocaleString()}%)`;

        // Set our testing URLs
        const subdomain = cname + (cname === '' ? '' : '.');
        const urlHttp = `http://${subdomain}js.org`;
        const urlHttps = `https://${subdomain}js.org`;

        // If in cache, use that
        if (cache && cname in cache) {
            log(`  [${position}] ${urlHttp} in cache, skipping tests.`, chalk.blue);
            tests[cname] = cache[cname];
            if (tests[cname].failed) failedCounter++;
            continue;
        }

        // Run the tests
        log(`  [${position}] Testing ${urlHttp}...`, chalk.blue);
        const failedHttp = await testUrl(urlHttp);
        const failedHttps = await testUrl(urlHttps);

        // Log any failures
        if (failedHttp || failedHttps) {
            // Log
            log(`    ...failed: HTTP: \`${failedHttp || 'Okay'}\` HTTPS: \`${failedHttps || 'Okay'}\``, chalk.yellow);

            // Save
            failedCounter++;
            const data = cnames[cname];
            data.http = failedHttp;
            data.https = failedHttps;
            data.failed = true;
            tests[cname] = data;
        } else {
            // Log
            log(`    ...succeeded`, chalk.green);

            // Save
            const data = cnames[cname];
            data.failed = false;
            tests[cname] = data;
        }

        // Save to cache
        setCache('validateCNAMEs', tests);
    }

    // Done
    const failed = {};
    const passed = {};
    for (const cname in tests) {
        if (!tests.hasOwnProperty(cname)) continue;
        const data = tests[cname];
        if (data.failed) failed[cname] = data;
        else passed[cname] = data;
    }
    log('Testing completed for validateCNAMEs', chalk.greenBright.bold);
    return { failed, passed }
};
