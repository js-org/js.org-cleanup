// Load in custom caching
const {getCache, setCache} = require("./cache.js");

// Load in our config
const config = require("./config.json");

// Load in Octokit for GitHub API
const Octokit = require("@octokit/rest");
const octokit = new Octokit({auth: config.github_token});

// Load in fs for files
const fs = require("fs");

// Load in chalk for logging
const chalk = require("chalk");

// Load custom jsdoc types
require("./types.js");

/**
 * Generates the issue body for the cname entry to be contacted
 * @param {string} cname - The cname of the entry being contacted
 * @param {cnameObject} data - The data for the cname given
 * @param {string} issue - The URL of the main cleanup issue
 * @returns {Promise<string>}
 */
const repoContactIssue = async (cname, data, issue) => {
    const tpl = await fs.readFileSync("templates/contact_issue.md", "utf8");
    return tpl
        .replace(/{{CNAME}}/g, cname)
        .replace(/{{TARGET}}/g, data.target)
        .replace(/{{HTTP}}/g, data.http)
        .replace(/{{HTTPS}}/g, data.https)
        .replace(/{{ISSUE}}/g, issue)
};

/**
 * Attempt to make contact via GitHub issues on failed cname entries
 * @param {cnamesObject} failed - All failed cname entries to try
 * @param {string} issueUrl - The main issue cleanup URL
 * @returns {Promise<cnamesAttemptedContact>}
 */
const attemptTargetIssues = async (failed, issueUrl) => {
    // Log
    console.log(chalk.cyanBright.bold("\nStarting attemptTargetIssues process"));

    // Fetch any cache we have
    const cache = await getCache("attemptTargetIssues");

    // Define some stuff
    const pending = {};
    const contact = {};

    // Attempt with each entry
    let counter = 0;
    let successCounter = 0;
    const totalLength = Object.keys(failed).length;
    for (const cname in failed) {
        if (!failed.hasOwnProperty(cname)) continue;

        // Set position info
        counter++;
        const position = `${counter.toLocaleString()}/${totalLength.toLocaleString()} ${Math.round(counter / totalLength * 100).toLocaleString()}% (Successes: ${successCounter.toLocaleString()} ${Math.round(successCounter / totalLength * 100).toLocaleString()}%)`;

        // If in cache, use that
        if (cache && cname in cache) {
            console.log(chalk.blue(`  [${position}] ${cname} in cache, skipping automatic contact.`));
            const data = cache[cname];
            if (data.contact) {
                successCounter++;
                contact[cname] = data;
            } else {
                pending[cname] = data;
            }
            continue;
        }

        // Get cname data
        const data = failed[cname];
        console.log(chalk.blue(`  [${position}] Attempting to contact ${cname} (${data.target})...`));

        // Regex time
        const reg = new RegExp(/(\S+).github.io(?:\/(\S+))?/g);
        const match = reg.exec(data.target);
        if (!match) {
            // Not a github.io target
            console.log(chalk.yellow("    ...failed, not a github target"));
            data.contact = false;
            pending[cname] = data;
        } else {
            // Github.io target!
            const owner = match[1];
            const repo = match[2] || `${match[1]}.github.io`;

            // Generate body
            const body = await repoContactIssue(cname, data, issueUrl);

            // Attempt to create issue
            let issue;
            try {
                issue = await octokit.issues.create({
                    owner,
                    repo,
                    title: "JS.ORG CLEANUP",
                    body
                });
            } catch (err) {
            }

            // Abort if no issue, else save issue data
            if (!issue || !issue.data) {
                console.log(chalk.yellow("    ...failed, could not create issue"));
                data.contact = false;
                pending[cname] = data;
            } else {
                console.log(chalk.green("    ...succeeded"));
                successCounter++;
                data.issue = issue.data;
                data.contact = true;
                contact[cname] = data;
            }
        }

        // Cache latest data
        await setCache("attemptTargetIssues", {...pending, ...contact});
    }

    // Done
    console.log(chalk.greenBright.bold("Attempts completed for attemptTargetIssues"));
    return {pending, contact}
};

/**
 * Converts js.org cname entries to the markdown cleanup list format
 * @param {cnamesObject} cnames - The entries to convert to MD
 * @returns {Array<string>}
 */
const entriesToList = cnames => {
    const list = [];
    for (const cname in cnames) {
        if (!cnames.hasOwnProperty(cname)) continue;
        const data = cnames[cname];
        list.push(`- [ ] **${cname}.js.org** > ${data.target}${data.issue ? `\n  Issue: ${data.issue.html_url}` : ""}\n  [HTTP](http://${cname}.js.org): \`${data.http}\`\n  [HTTPS](https://${cname}.js.org): \`${data.https}\``);
    }
    return list;
};

/**
 * Create the main cleanup issue on the js.org repository
 * @param {cnamesObject} failed - All failed cname entries for the issue lists
 * @returns {Promise<string>}
 */
const createMainIssue = async failed => {
    // Log
    console.log(chalk.cyanBright.bold("\nStarting createMainIssue process"));

    // Fetch any cache we have
    const cache = await getCache("createMainIssue");
    if (cache) {
        console.log(chalk.greenBright.bold("Cached data found for createMainIssue"));
        return cache.html_url;
    }

    // Create new empty issue
    const owner = "js-org-cleanup";
    const repo = "test-repo-1";
    const issue = await octokit.issues.create({
        owner,
        repo,
        title: "JS.ORG CLEANUP",
        body: "Automatic initial cleanup contact in progress... this issue will be updated shortly."
    });

    // Attempt automatic contact
    const {pending, contact} = await attemptTargetIssues(failed, issue.data.html_url);

    // Log
    console.log(chalk.cyanBright.bold("\nResuming createMainIssue process"));

    // Convert them to MD list
    const pendingList = entriesToList(pending);
    const contactList = entriesToList(contact);

    // Generate the contents
    const contactIssue = await repoContactIssue(
        "xxx",
        {target: "xxx", http: "xxx", https: "xxx"},
        issue.data.html_url);
    const tpl = await fs.readFileSync("templates/main_issue.md", "utf8");
    const body = tpl
        .replace(/{{PENDING_LIST}}/g, pendingList.join("\n"))
        .replace(/{{CONTACT_LIST}}/g, contactList.join("\n"))
        .replace(/{{CONTACT_ISSUE}}/g, contactIssue);

    // Edit the issue
    await octokit.issues.update({
        owner,
        repo,
        issue_number: issue.data.number,
        body
    });

    // Save to cache
    await setCache("createMainIssue", issue.data);

    // Done
    console.log(chalk.greenBright.bold("Issue creation completed for createMainIssue"));
    return issue.data.html_url;
};

// Export
module.exports = {createMainIssue};
