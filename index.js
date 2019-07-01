// Load in our config
const config = require("./config.json");

// Load in CNAME operation
const {validateCNAMEs} = require("./cnames.js");

// Load in string formatting
require("./string.js");

// Load in Octokit for GitHub API
const Octokit = require("@octokit/rest");
const octokit = new Octokit({auth: config.github_token});

// Load in fs for files
const fs = require("fs");

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

    /*
     * TODO: Automatically create cleanup issues here (where possible)
     * This will need to have lots of redundancy so we don't spam issues on random repos
     * Use the cache system to only ever attempt to post on a repo once
     * Store failure or the issue data if successful
     * Cache everything!
     * Return only the successful issue data for use in the {{CONTACT}} list
     */

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
