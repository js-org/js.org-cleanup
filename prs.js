// Load in custom caching
const {removeCache} = require("./cache.js");

// Load in templates
const {robotDisclaimer, mainPullRequest} = require("./templates.js");

// Load in all the cnames stuff
const {getCNAMEsFile, getCNAMEs, generateCNAMEsFile} = require("./cnames.js");

// Load in issue related actions
const {parseIssueEntries} = require("./issues.js");

// Load in our config
const config = require("./config.json");

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
    console.log(chalk.cyanBright.bold("\nStarting perfectCNAMEsFile process"));

    // Get the original file
    const file = await getCNAMEsFile();

    // Get the raw cnames
    const cnames = await getCNAMEs(file);

    // Get the new file
    const newFile = await generateCNAMEsFile(cnames, file);

    // Log
    console.log(chalk.cyanBright.bold("\nResuming perfectCNAMEsFile process"));

    // Compare
    if (newFile == file) {
        // Log
        console.log(chalk.yellow("  Existing file is already perfect, no changes"));

        // Reset cache
        console.log(chalk.blue("  Purging cache before completion"));
        await removeCache("getCNAMEs");
        await removeCache("generateCNAMEsFile");

        // Done
        console.log(chalk.greenBright.bold("Generation completed for perfectCNAMEsFile"));
        return;
    }

    // Create fork, commit & PR
    console.log(chalk.yellow("  Changes are required to make the file perfect"));
    console.log(chalk.blue("  Creating pull request with changes..."));
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
    console.log(chalk.green("    ...pull request created"));
    console.log(chalk.blue("  Purging cache before completion"));
    await removeCache("getCNAMEs");
    await removeCache("generateCNAMEsFile");

    // Done
    console.log(chalk.greenBright.bold("Generation completed for perfectCNAMEsFile"));
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
    console.log(chalk.cyanBright.bold("\nStarting mainCleanupPull process"));

    // Fetch any cache we have
    // TODO: waiting on https://github.com/gr2m/octokit-create-pull-request/pull/13 for PR data
    /*const cache = await getCache("mainCleanupPull");
    if (cache) {
        console.log(chalk.greenBright.bold("Cached data found for mainCleanupPull"));
        return cache.html_url;
    }*/

    // Get the file so we only need to fetch once
    const file = await getCNAMEsFile();

    // Fetch all cname data
    const allCNAMEs = await getCNAMEs(file);

    // Get the bad cnames
    const badCNAMEs = await parseIssueEntries(issueNumber);

    // Log
    console.log(chalk.cyanBright.bold("\nResuming mainCleanupPull process"));

    // Generate new cname data w/o bad cnames
    const newCNAMEs = {};
    for (const cname in allCNAMEs) {
        if (!allCNAMEs.hasOwnProperty(cname)) continue;
        if (badCNAMEs.includes(cname)) {
            console.log(chalk.blue(`  Removed ${cname} from cnames_active`));
            continue;
        }
        newCNAMEs[cname] = allCNAMEs[cname];
    }

    // Generate new cnames_active
    const cnamesActive = await generateCNAMEsFile(newCNAMEs, file);

    // Log
    console.log(chalk.cyanBright.bold("\nResuming mainCleanupPull process"));

    // Create PR info
    const body = await mainPullRequest(issueNumber, badCNAMEs);
    const name = `JS.ORG CLEANUP (#${issueNumber})`;

    // Make pull request
    console.log(chalk.blue("  Creating pull request with changes..."));
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

    // Save to cache
    // TODO: waiting on https://github.com/gr2m/octokit-create-pull-request/pull/13 for PR data
    /*await setCache("mainCleanupPull", pr.data);*/

    // Reset cache
    console.log(chalk.green("    ...pull request created"));
    console.log(chalk.blue("  Purging cache before completion"));
    await removeCache("getCNAMEs");
    await removeCache("parseIssueCNAMEs");

    // Done
    console.log(chalk.greenBright.bold("Generation completed for mainCleanupPull"));
    // TODO: waiting on https://github.com/gr2m/octokit-create-pull-request/pull/13 for PR data
    /*return pr.data.html_url;*/
};

// Export
module.exports = {perfectCNAMEsFile, mainCleanupPull};
