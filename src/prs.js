// Load in custom logging
const {logDown, logUp, log} = require("./log.js");

// Load in custom caching
const {getCache, setCache, removeCache} = require("./cache.js");

// Load in templates
const {robotDisclaimer, mainPullRequest} = require("./templates.js");

// Load in all the cnames stuff
const {getCNAMEsFile, getCNAMEs, generateCNAMEsFile} = require("./cnames.js");

// Load in issue related actions
const {parseIssueEntries} = require("./issues.js");

// Load in our config
const config = require("../config.json");

// Load in Octokit for GitHub API
const Octokit = require("@octokit/rest").plugin(require("octokit-create-pull-request"));
const octokit = new Octokit({auth: config.github_token});

// Load in chalk for logging
const chalk = require("chalk");

/**
 * Generates a perfect cnames_active.js file w/ pull request
 * @returns {Promise<void>}
 */
const perfectCNAMEsFile = async () => {
    // Log
    log("\nStarting perfectCNAMEsFile process", chalk.cyanBright.bold);

    // Get the original file
    logDown();
    const file = await getCNAMEsFile();
    logUp();

    // Get the raw cnames
    logDown();
    const cnames = await getCNAMEs(file);
    logUp();

    // Get the new file
    logDown();
    const newFile = await generateCNAMEsFile(cnames, file);
    logUp();

    // Log
    log("\nResuming perfectCNAMEsFile process", chalk.cyanBright.bold);

    // Compare
    if (newFile == file) {
        // Log
        log("  Existing file is already perfect, no changes", chalk.green);

        // Reset cache
        log("  Purging cache before completion", chalk.blue);
        await removeCache("getCNAMEs");
        await removeCache("generateCNAMEsFile");

        // Done
        log("Generation completed for perfectCNAMEsFile", chalk.greenBright.bold);
        return;
    }

    // Create fork, commit & PR
    log("  Changes are required to make the file perfect", chalk.yellow);
    log("  Creating pull request with changes...", chalk.blue);
    const pr = await octokit.createPullRequest({
        owner: config.repository_owner,
        repo: config.repository_name,
        title: "Cleanup: Perfect Format & Sorting",
        body: `This pull request cleans up the cnames_active.js file by ensuring the formatting and sorting is perfect.${await robotDisclaimer()}`,
        head: "cleanup-perfect",
        changes: {
            files: {
                "cnames_active.js": newFile
            },
            commit: "Cleanup: Perfect Format & Sorting"
        }
    });

    // Reset cache
    log("    ...pull request created", chalk.green);
    log("  Purging cache before completion", chalk.blue);
    await removeCache("getCNAMEs");
    await removeCache("generateCNAMEsFile");

    // Done
    log("Generation completed for perfectCNAMEsFile", chalk.greenBright.bold);
    // TODO: waiting on https://github.com/gr2m/octokit-create-pull-request/pull/13 for PR data
    /*return pr.data.html_url;*/
};

/**
 * Creates the main cleanup process final pull request based on the given cleanup issue number
 * @param {int} issueNumber - The cleanup issue to parse for bad cname entries
 * @returns {Promise<void>}
 */
const mainCleanupPull = async issueNumber => {
    // Log
    log("\nStarting mainCleanupPull process", chalk.cyanBright.bold);

    // Fetch any cache we have
    const cache = await getCache("mainCleanupPull");
    if (cache) {
        log("Cached data found for mainCleanupPull", chalk.greenBright.bold);
        return cache.html_url;
    }

    // Lock issue
    log("  Locking cleanup issue...", chalk.blue);
    await octokit.issues.lock({
        owner: config.repository_owner,
        repo: config.repository_name,
        issue_number: issueNumber
    });
    log("    ...issue locked", chalk.green);

    // Get the file so we only need to fetch once
    logDown();
    const file = await getCNAMEsFile();
    logUp();

    // Fetch all cname data
    logDown();
    const allCNAMEs = await getCNAMEs(file);
    logUp();

    // Get the bad cnames
    logDown();
    const badCNAMEs = await parseIssueEntries(issueNumber);
    logUp();

    // Log
    log("\nResuming mainCleanupPull process", chalk.cyanBright.bold);

    // Generate new cname data w/o bad cnames
    const newCNAMEs = {};
    for (const cname in allCNAMEs) {
        if (!allCNAMEs.hasOwnProperty(cname)) continue;
        if (badCNAMEs.includes(cname)) {
            log(`  Removed ${cname} from cnames_active`, chalk.blue);
            continue;
        }
        newCNAMEs[cname] = allCNAMEs[cname];
    }

    // Generate new cnames_active
    logDown();
    const cnamesActive = await generateCNAMEsFile(newCNAMEs, file);
    logUp();

    // Log
    log("\nResuming mainCleanupPull process", chalk.cyanBright.bold);

    // Create PR info
    const body = await mainPullRequest(issueNumber, badCNAMEs);
    const name = `JS.ORG CLEANUP (#${issueNumber})`;

    // Make pull request
    log("  Creating pull request with changes...", chalk.blue);
    const pr = await octokit.createPullRequest({
        owner: config.repository_owner,
        repo: config.repository_name,
        title: name,
        body,
        head: "cleanup",
        changes: {
            files: {
                "cnames_active.js": cnamesActive
            },
            commit: name
        }
    });
    log("    ...pull request created", chalk.green);

    // Save to cache
    await setCache("mainCleanupPull", pr.data);

    // Reset cache
    log("  Purging cache before completion", chalk.blue);
    await removeCache("getCNAMEs");
    await removeCache("parseIssueCNAMEs");

    // Done
    log("Generation completed for mainCleanupPull", chalk.greenBright.bold);
    return pr.data.html_url;
};

// Export
module.exports = {perfectCNAMEsFile, mainCleanupPull};
