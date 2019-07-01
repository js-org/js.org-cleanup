// Load in our config
const config = require("./config.json");

// Load in Octokit for GitHub API
const Octokit = require("@octokit/rest");
const octokit = new Octokit({auth: config.github_token});

// Load in fetch for URL testing
const fetch = require("node-fetch");

// Load in fs for files
const fs = require("fs");

// Custom String.format
if (!String.prototype.format) {
    String.prototype.format = function () {
        const args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != "undefined"
                ? args[number]
                : match
                ;
        });
    };
}

/**
 * Fetch cached data for the given function name
 * @param {string} name - Function name for cache
 * @returns {Promise<?*> | ?*}
 */
const getCache = async name => {
    const path = `cache/${name}.json`;
    if (!fs.existsSync(path)) return;
    const file = await fs.readFileSync(path, "utf8");
    if (!file) return;
    const data = JSON.parse(file);
    if (!data) return;
    return data;
};

/**
 * Sets the cached data for a given function name
 * @param {string} name - The function name to cache data for
 * @param {*} contents - The data to store
 * @returns {Promise<void>}
 */
const setCache = async (name, contents) => {
    if (!fs.existsSync("cache/")) {
        await fs.mkdirSync("cache")
    }
    const path = `cache/${name}.json`;
    const data = JSON.stringify(contents);
    await fs.writeFileSync(path, data);
};

/**
 * @typedef {object} cnameObject
 * @property {string} target - The CNAME target
 * @property {string} [noCF] - The noCF tag (if present) on the record
 * @property {string} [http] - The status of the HTTP test (if failed)
 * @property {string} [https] - The status of the HTTPS test (if failed)
 * @property {boolean} [failed] - If the testing failed
 */

/**
 * Get all valid CNAME entries from the js.org repository
 * @returns {Promise<Object.<string, cnameObject>>} - Every entry in the CNAMEs file
 */
const getCNAMEs = async () => {
    const cache = await getCache("getCNAMEs");
    if (cache) {
        console.log("Cached data found for getCNAMEs");
        return cache;
    }

    // Get the raw GitHub API data
    const req = await octokit.repos.getContents({
        owner: "js-org",
        repo: "js.org",
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
 * @returns {Promise<Object.<string, cnameObject>>} - Any failed CNAME entries
 */
const validateCNAMEs = async () => {
    // Get the CNAMEs
    const cnames = await getCNAMEs();

    // Fetch any cache we have
    const cache = await getCache("validateCNAMEs");

    // Define some stuff
    const urlBase = "http{0}://{1}js.org";
    const tests = {};

    // DEV: only test the first few
    const slice = Object.keys(cnames).slice(10);
    for (const key in slice) {
        delete cnames[slice[key]];
    }

    // Test each entry
    for (const cname in cnames) {
        if (!cnames.hasOwnProperty(cname)) continue;

        // Set our testing URLs
        const subdomain = cname + (cname == "" ? "" : ".");
        const urlHttp = urlBase.format("", subdomain);
        const urlHttps = urlBase.format("s", subdomain);

        // If in cache, use that
        if (cache && cname in cache) {
            console.log(`${urlHttp} in cache, skipping.`);
            tests[cname] = cache[cname];
            continue;
        }

        // Run the tests
        console.log(`Testing ${urlHttp}...`);
        const failedHttp = await testUrl(urlHttp);
        const failedHttps = await testUrl(urlHttps);

        // Allow one to fail without care
        if (failedHttp && failedHttps) {
            // Log
            console.log(`  ...failed: HTTP: \`${failedHttp}\` HTTPS: \`${failedHttps}\``);

            // Save
            const data = cnames[cname];
            data.http = failedHttp;
            data.https = failedHttps;
            data.failed = true;
            tests[cname] = data;
        } else {
            // Log
            console.log(`  ...succeeded`);

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
    return failed
};

/**
 * Fetches & validates all CNAME entries, formats them into the JS.org cleanup issue template
 */
const createIssue = async () => {
    // Get the failed CNAMEs
    const failed = await validateCNAMEs();

    // Convert them to MD list
    const base = "- [ ] **{0}.js.org** > {1}\n  [HTTP](http://{0}.js.org): `{2}`\n  [HTTPS](https://{0}.js.org): `{3}`";
    const list = [];
    for (const cname in failed) {
        if (!failed.hasOwnProperty(cname)) continue;
        const data = failed[cname];
        list.push(base.format(cname, data.target, data.http, data.https));
    }

    // TODO: Automatically create cleanup issues here (where possible), will inject into a separate CONTACT list

    // Create new empty issue
    const owner = "js-org-cleanup";
    const repo = "test-repo-1";
    const issue = await octokit.issues.create({
        owner,
        repo,
        title: "JS.ORG CLEANUP"
    });

    // Generate the contents
    const file = await fs.readFileSync("main_issue.tpl.md", "utf8");
    const newFile = file
        .replace(/{{PENDING}}/g, list.join("\n"))
        .replace(/{{CONTACT}}/g, "")
        .replace(/{{ISSUE_URL}}/g, issue.data.html_url);


    // Edit the issue
    await octokit.issues.update({
        owner,
        repo,
        issue_number: issue.data.number,
        body: newFile
    })
};

createIssue();

// TODO: parse issue to detect entries that were not ticked
// TODO: remove un-ticked entries from the cnames_active file
// TODO: create PR to update cnames_active file (ref issue)
