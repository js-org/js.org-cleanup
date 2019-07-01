// Load in custom caching
const {getCache, setCache} = require("./cache.js");

// Load in our config
const config = require("./config.json");

// Load in Octokit for GitHub API
const Octokit = require("@octokit/rest");
const octokit = new Octokit({auth: config.github_token});

// Load in fs for files
const fs = require("fs");

// Load custom jsdoc types
require("./types.js");

/**
 * Attempt to make contact via GitHub issues on failed cname entries
 * @param {cnamesObject} failed - All failed cname entries to try
 * @param {string} issueUrl - The main issue cleanup URL
 * @returns {Promise<cnamesAttemptedContact>}
 */
const attemptTargetIssues = async (failed, issueUrl) => {
    /*
     * TODO: Automatically create cleanup issues here (where possible)
     * This will need to have lots of redundancy so we don't spam issues on random repos
     * Use the cache system to only ever attempt to post on a repo once
     * Store failure or the issue data if successful
     * Cache everything!
     * Return only the successful issue data for use in the {{CONTACT}} list
     */

    // Fetch any cache we have
    const cache = await getCache("attemptTargetIssues");

    // Define some stuff
    const pending = {};
    const contact = {};

    // Attempt with each entry
    for (const cname in failed) {
        if (!failed.hasOwnProperty(cname)) continue;

        // If in cache, use that
        if (cache && cname in cache) {
            const data = cache[cname];
            if (data.contact) {
                contact[cname] = data;
            } else {
                pending[cname] = data;
            }
            continue;
        }

        // Get cname data
        const data = failed[cname];

        // Regex time
        const reg = new RegExp(/(\S+).github.io(?:\/(\S+))?/g);
        const match = reg.exec(data.target);
        if (!match) {
            // Not a github.io target
            data.contact = false;
            pending[cname] = data;
        } else {
            // Github.io target!
            // TODO: Set repo if no repo match
            // TODO: Attempt to create issue
            data.contact = false;
            pending[cname] = data;
        }

        await setCache("attemptTargetIssues", {...pending, ...contact});
    }

    // Done
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
        list.push(`- [ ] **${cname}.js.org** > ${data.target}\n  [HTTP](http://${cname}.js.org): \`${data.http}\`\n  [HTTPS](https://${cname}.js.org): \`${data.https}\``);
    }
    return list;
};

/**
 * Create the main cleanup issue on the js.org repository
 * @param {cnamesObject} failed - All failed cname entries for the issue lists
 * @returns {Promise<string>}
 */
const createMainIssue = async failed => {
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

    // Convert them to MD list
    const pendingList = entriesToList(pending);
    const contactList = entriesToList(contact);

    // Generate the contents
    const file = await fs.readFileSync("main_issue.tpl.md", "utf8");
    const newFile = file
        .replace(/{{PENDING}}/g, pendingList.join("\n"))
        .replace(/{{CONTACT}}/g, contactList.join("\n"))
        .replace(/{{ISSUE_URL}}/g, issue.data.html_url);

    // Edit the issue
    await octokit.issues.update({
        owner,
        repo,
        issue_number: issue.data.number,
        body: newFile
    });

    // Done
    return issue.data.html_url;
};

// Export
module.exports = {createMainIssue};
