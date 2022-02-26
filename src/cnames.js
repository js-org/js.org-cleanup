// Load in custom logging
const { logDown, logUp, log } = require("./log.js");

// Load in custom caching
const { getCache, setCache } = require("./cache.js");

// Load in our config
const config = require("../config.json");

// Load in string formatting
require("./string.js");

// Load in URL for checking redirects
const { URL } = require("url");

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
 * Fetches the raw cnames_active file from the configured repository
 * @returns {Promise<string>}
 */
const getCNAMEsFile = async () => {
    // Log
    log("\nStarting getCNAMEsFile process", chalk.cyanBright.bold);

    // Get the raw GitHub API data
    const req = await octokit.repos.getContents({
        owner: config.repository_owner,
        repo: config.repository_name,
        path: "cnames_active.js"
    });

    // Get the contents of the file
    const content = Buffer.from(req.data.content, req.data.encoding).toString();

    // Done
    log("Fetching completed for getCNAMEsFile", chalk.greenBright.bold);
    return content;
};

/**
 * Get all valid CNAME entries from the js.org repository
 * @param {string} [file] - The cnames file to use (will fetch if not provided)
 * @returns {Promise<cnamesObject>} - Every entry in the CNAMEs file
 */
const getCNAMEs = async (file) => {
    // Log
    log("\nStarting getCNAMEs process", chalk.cyanBright.bold);

    // Fetch any cache we have
    const cache = await getCache("getCNAMEs");
    if (cache) {
        log("Cached data found for getCNAMEs", chalk.greenBright.bold);
        return cache;
    }

    // Get the raw cnames file
    if (!file) {
        logDown();
        file = await getCNAMEsFile();
        logUp();
        log("\nResuming getCNAMEs process", chalk.cyanBright.bold);
    }

    // Regex time
    const reg = new RegExp(/[ \t]*["'](.*)["'][ \t]*:[ \t]*["'](.*)["'][ \t]*,?[ \t]*(\/\/ *[Nn][Oo][Cc][Ff].*)?[ \t]*\n/g);
    const cnames = {};
    let match;
    while ((match = reg.exec(file)) !== null) {
        cnames[match[1]] = {
            target: match[2],
            noCF: match[3] ? `// noCF${match[3].slice(2).trim().slice(4)}` : undefined,
        }
    }

    // Save to cache
    await setCache("getCNAMEs", cnames);

    // Done
    log("Parsing completed for getCNAMEs", chalk.greenBright.bold);
    return cnames
};

/**
 * Create a perfectly formatted cnames_active file based on the data provided
 * @param {cnamesObject} cnames - The cnames data to use in the file
 * @param {string} [file] - The cnames file to use (will fetch if not provided)
 * @returns {Promise<?string> | ?string}
 */
const generateCNAMEsFile = async (cnames, file) => {
    // Log
    log("\nStarting generateCNAMEsFile process", chalk.cyanBright.bold);

    // Get the raw cnames file
    if (!file) {
        logDown();
        file = await getCNAMEsFile();
        logUp();
        log("\nResuming generateCNAMEsFile process", chalk.cyanBright.bold);
    }

    // Regex time to find the top/bottom comment blocks
    const reg = new RegExp(/(\/\*[\S\s]+?\*\/)/g);
    const commentBlocks = [];
    let match;
    while ((match = reg.exec(file)) !== null) {
        commentBlocks.push(match[1]);
    }

    // Abort if couldn't find the top/bottom blocks
    if (commentBlocks.length < 2) {
        // Log
        log("  Could not locate top & bottom comment blocks in raw file", chalk.yellow);
        log("Generation aborted for generateCNAMEsFile", chalk.redBright.bold);
        return;
    }
    log("  Comment blocks located in existing raw file", chalk.blue);

    // Get perfect alphabetical order
    cnames = Object.fromEntries(Object.entries(cnames).map(entry => [entry[0].toLowerCase(), entry[1]]));
    const cnamesKeys = Object.keys(cnames);
    cnamesKeys.sort();

    // Generate the new file entries
    const cnamesList = [];
    for (const i in cnamesKeys) {
        const cname = cnamesKeys[i];
        const data = cnames[cname];
        cnamesList.push(`  "${cname}": "${data.target}"${Number(i) === cnamesKeys.length - 1 ? "" : ","}${data.noCF ? ` ${data.noCF}` : ""}`)
    }

    // Format into the new file
    const content = `${commentBlocks[0]}\n\nvar cnames_active = {\n${cnamesList.join("\n")}\n  ${commentBlocks[1]}\n}\n`;

    // Done
    log("Generation completed for generateCNAMEsFile", chalk.greenBright.bold);
    return content
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
        if (err.name === "AbortError") return "Failed due to time out after 5s";
        return `Failed during request with error '${err}'`;
    } finally {
        clearTimeout(timer);
    }
    if (!resp.ok) {
        return `Failed with status code '${resp.status} ${resp.statusText}'`;
    }
    if (resp.redirected && !(new URL(resp.url).origin.endsWith('.js.org'))) {
        return `Failed due to automatic redirect to '${resp.url}'`;
    }
    const text = await resp.text();
    if (text.toLowerCase().trim() === "") {
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
    log("\nStarting validateCNAMEs process", chalk.cyanBright.bold);

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
            log(`  [${position}] ${urlHttp} in cache, skipping tests.`, chalk.blue);
            tests[cname] = cache[cname];
            if (tests[cname].failed) failedCounter++;
            continue;
        }

        // Run the tests
        log(`  [${position}] Testing ${urlHttp}...`, chalk.blue);
        const failedHttp = await testUrl(urlHttp);
        const failedHttps = await testUrl(urlHttps);

        // Allow one to fail without care
        if (failedHttp && failedHttps) {
            // Log
            log(`    ...failed: HTTP: \`${failedHttp}\` HTTPS: \`${failedHttps}\``, chalk.yellow);

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
        await setCache("validateCNAMEs", tests);
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
    log("Testing completed for validateCNAMEs", chalk.greenBright.bold);
    return { failed, passed }
};

// Export
module.exports = { getCNAMEsFile, getCNAMEs, generateCNAMEsFile, validateCNAMEs };
