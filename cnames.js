// Load in custom caching
const {getCache, setCache} = require("./cache.js");

// Load in our config
const config = require("./config.json");

// Load in string formatting
require("./string.js");

// Load in Octokit for GitHub API
const Octokit = require("@octokit/rest");
const octokit = new Octokit();

// Load in fetch for URL testing
const fetch = require("node-fetch");

// Load in chalk for logging
const chalk = require("chalk");

// Load custom jsdoc types
require("./types.js");

/**
 * Get all valid CNAME entries from the js.org repository
 * @returns {Promise<cnamesObject>} - Every entry in the CNAMEs file
 */
const getCNAMEs = async () => {
    // Log
    console.log(chalk.cyanBright.bold("\nStarting getCNAMEs process"));

    // Fetch any cache we have
    const cache = await getCache("getCNAMEs");
    if (cache) {
        console.log(chalk.greenBright.bold("Cached data found for getCNAMEs"));
        return cache;
    }

    // Get the raw GitHub API data
    const req = await octokit.repos.getContents({
        owner: config.repository_owner,
        repo: config.repository_name,
        path: "cnames_active.js"
    });

    // Get the contents of the file
    const file = Buffer.from(req.data.content, req.data.encoding).toString();

    // Regex time
    const reg = new RegExp(/[ \t]*["'](.*)["'][ \t]*:[ \t]*["'](.*)["'][ \t]*,?[ \t]*(.+)?[ \t]*\n/g);
    const cnames = {};
    let match;
    while ((match = reg.exec(file)) !== null) {
        cnames[match[1]] = {
            target: match[2],
            noCF: match[3]
        }
    }

    // Save to cache
    await setCache("getCNAMEs", cnames);

    // Done
    console.log(chalk.greenBright.bold("Fetching completed for getCNAMEs"));
    return cnames
};

/**
 * Test a given URL and provides a string with the error
 * @param {string} url - The URL to test
 * @returns {Promise<?string>} - The failure error message (or undefined if successful)
 */
const testUrl = async url => {
    let resp;
    try {
        resp = await fetch(url, {timeout: 1000});
    } catch (err) {
        return `Failed during request with error '${err}'`
    }
    if (!resp.ok) {
        return `Failed with status code '${resp.status} ${resp.statusText}'`
    }
    if (!resp.text()) {
        return `Failed with empty return body (status '${resp.status} ${resp.statusText}')`
    }
};

/**
 * Fetches the js.org CNAME entries and then validates each one using a HTTP & HTTPS test
 * @returns {Promise<cnamesObject>} - Any failed CNAME entries
 */
const validateCNAMEs = async () => {
    // Get the CNAMEs
    const cnames = await getCNAMEs();

    // Log
    console.log(chalk.cyanBright.bold("\nStarting validateCNAMEs process"));

    // Fetch any cache we have
    const cache = await getCache("validateCNAMEs");

    // Define some stuff
    const urlBase = "http{0}://{1}js.org";
    const tests = {};

    // DEV: only test the first few
    if (config.dev_restrict_cname_count) {
        const slice = Object.keys(cnames).slice(10);
        for (const key in slice) {
            delete cnames[slice[key]];
        }
    }

    // Test each entry
    let counter = 0;
    let failedCounter = 0;
    const totalLength = Object.keys(cnames).length;
    for (const cname in cnames) {
        if (!cnames.hasOwnProperty(cname)) continue;

        // Set position info
        counter++;
        const position = `${counter.toLocaleString()}/${totalLength.toLocaleString()} ${Math.round(counter / totalLength * 100).toLocaleString()}% (Failures: ${failedCounter.toLocaleString()} ${Math.round(failedCounter / totalLength * 100).toLocaleString()}%)`;

        // Set our testing URLs
        const subdomain = cname + (cname == "" ? "" : ".");
        const urlHttp = urlBase.format("", subdomain);
        const urlHttps = urlBase.format("s", subdomain);

        // If in cache, use that
        if (cache && cname in cache) {
            console.log(chalk.blue(`  [${position}] ${urlHttp} in cache, skipping tests.`));
            tests[cname] = cache[cname];
            if (tests[cname].failed) failedCounter++;
            continue;
        }

        // Run the tests
        console.log(chalk.blue(`  [${position}] Testing ${urlHttp}...`));
        const failedHttp = await testUrl(urlHttp);
        const failedHttps = await testUrl(urlHttps);

        // Allow one to fail without care
        if (failedHttp && failedHttps) {
            // Log
            console.log(chalk.yellow(`    ...failed: HTTP: \`${failedHttp}\` HTTPS: \`${failedHttps}\``));

            // Save
            failedCounter++;
            const data = cnames[cname];
            data.http = failedHttp;
            data.https = failedHttps;
            data.failed = true;
            tests[cname] = data;
        } else {
            // Log
            console.log(chalk.green(`    ...succeeded`));

            // Save
            const data = cnames[cname];
            data.failed = false;
            tests[cname] = data;
        }

        // Save to cache
        await setCache("validateCNAMEs", tests);
    }

    // Done
    const failed = {};
    for (const cname in tests) {
        if (!tests.hasOwnProperty(cname)) continue;
        const data = tests[cname];
        if (data.failed) failed[cname] = data;
    }
    console.log(chalk.greenBright.bold("Testing completed for validateCNAMEs"));
    return failed
};

// Export
module.exports = {getCNAMEs, validateCNAMEs};
