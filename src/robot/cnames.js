// Load in custom logging
const { log } = require('../util/log');

// Load in custom caching
const { getCache, setCache } = require('./cache');

// Load in our config
const config = require('../../config.json');

// Load in URL for checking redirects
const { URL } = require('url');

// Load in Octokit for GitHub API
const Octokit = require('@octokit/rest');
const octokit = new Octokit();

// Load in fetch for URL testing
const fetch = require('node-fetch');

// Load in chalk for logging
const chalk = require('chalk');

// Load custom jsdoc types
require('../util/types');

/**
 * Fetches the raw cnames_active file from the configured repository
 * @returns {Promise<string>}
 */
const getCNAMEsFile = async () => {
    // Log
    log('\nStarting getCNAMEsFile process', chalk.cyanBright.bold);

    // Get the raw GitHub API data
    const req = await octokit.repos.getContents({
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
    let resp;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
        resp = await fetch(url, { signal: controller.signal });
    } catch (err) {
        if (err.name === 'AbortError') return 'Failed due to time out after 5s';
        return `Failed during request with error '${err}'`;
    } finally {
        clearTimeout(timer);
    }
    if (!resp.ok) return `Failed with status code '${resp.status} ${resp.statusText}'`;

    // Only allow redirects within js.org
    const origin = new URL(resp.url).origin;
    if (resp.redirected && origin !== 'https://js.org' && !origin.endsWith('.js.org')) {
        return `Failed due to automatic redirect to '${resp.url}'`;
    }

    const text = await resp.text();
    if (text.toLowerCase().trim() === '') {
        return `Failed with empty return body (status '${resp.status} ${resp.statusText}')`;
    }
};

/**
 * Validates each CNAME entry using a HTTP & HTTPS test
 * @param {cnamesObject} cnames - Every entry to test
 * @returns {Promise<cnamesValidationObject>} - The results of the validation ({failed, passed})
 */
const validateCNAMEs = async (cnames) => {
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

// Export
module.exports = { getCNAMEsFile, validateCNAMEs };
