// Load in custom logging
const { logDown, logUp, log } = require('../util/log');

// Load in custom caching
const { getCache, setCache, removeCache } = require('./cache');

// Load in our config
const config = require('../../config.json');

// Load in all the cnames stuff
const { getCNAMEsFile, validateCNAMEs } = require('./cnames');
const { parseCNAMEsFile } = require('../util/cnames');

// Load in templates
const { repoContactIssue } = require('./templates');

// Load in confirm script
const confirm = require('./confirm');

// Load in Octokit for GitHub API
const Octokit = require('@octokit/rest');
const octokit = new Octokit({ auth: config.github_token });

// Load in fs for files
const fs = require('fs');

// Load in chalk for logging
const chalk = require('chalk');

// Load custom jsdoc types
require('../util/types');

/**
 * Attempt to make contact via GitHub issues on failed cname entries
 * @param {cnamesObject} failed - All failed cname entries to try
 * @param {string} issueUrl - The main issue cleanup URL
 * @returns {Promise<cnamesAttemptedContact>}
 */
const attemptTargetIssues = async (failed, issueUrl) => {
    // Log
    log('\nStarting attemptTargetIssues process', chalk.cyanBright.bold);

    // Fetch any cache we have
    const cache = await getCache('attemptTargetIssues');

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
            log(`  [${position}] ${cname} in cache, skipping automatic contact.`, chalk.blue);
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
        log(`  [${position}] Attempting to contact ${cname} (${data.target})...`, chalk.blue);

        // Regex time
        const reg = new RegExp(/(\S+).github.io(?:\/(\S+))?/g);
        const match = reg.exec(data.target);
        if (!match) {
            // Not a github.io target
            log('    ...failed, not a github target', chalk.yellow);
            data.contact = false;
            pending[cname] = data;
        } else {
            // Github.io target!
            const owner = match[1];
            const repo = match[2] || `${match[1]}.github.io`;

            // Generate body
            const body = await repoContactIssue(cname, data, issueUrl, true);

            // Attempt to create issue
            let issue;
            try {
                issue = await octokit.issues.create({
                    owner,
                    repo,
                    title: 'JS.ORG CLEANUP',
                    body
                });
            } catch (err) {
            }

            // Abort if no issue, else save issue data
            if (!issue || !issue.data) {
                log('    ...failed, could not create issue', chalk.yellow);
                data.contact = false;
                pending[cname] = data;
            } else {
                log('    ...succeeded', chalk.green);
                successCounter++;
                data.issue = issue.data;
                data.contact = true;
                contact[cname] = data;
            }
        }

        // Cache latest data
        await setCache('attemptTargetIssues', { ...pending, ...contact });
    }

    // Done
    log('Attempts completed for attemptTargetIssues', chalk.greenBright.bold);
    return { pending, contact }
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
        list.push(`- [ ] **${cname}.js.org** > ${data.target}${data.issue ? `\n  Issue: ${data.issue.html_url}` : ''}\n  [HTTP](http://${cname}.js.org): \`${data.http}\`\n  [HTTPS](https://${cname}.js.org): \`${data.https}\``);
    }
    return list;
};

/**
 * Fetches & validates all CNAME entries, formats them into the JS.org cleanup issue template
 * @returns {Promise<string>}
 */
const createMainIssue = async () => {
    // Log
    log('\nStarting createMainIssue process', chalk.cyanBright.bold);

    // Fetch any cache we have
    const cache = await getCache('createMainIssue');
    if (cache) {
        log('Cached data found for createMainIssue', chalk.greenBright.bold);
        return cache.html_url;
    }

    // Get the original file
    logDown();
    const file = await getCNAMEsFile();
    logUp();

    // Get the raw cnames
    logDown();
    const cnames = parseCNAMEsFile(file);
    logUp();

    // Get the failed CNAMEs
    logDown();
    const { failed } = await validateCNAMEs(cnames);
    logUp();

    // DEV: custom test failed record
    if (config.dev_fake_cnames) {
        // Clear out all the real cnames
        for (const cname in failed) {
            if (!failed.hasOwnProperty(cname)) continue;
            delete failed[cname];
        }
        // Should be able to create automatic contact issue
        failed['test'] = {
            target: 'js-org-cleanup.github.io/test-repo-2',
            http: 'Failed with status code \'404 Not Found\'',
            https: 'Failed with status code \'404 Not Found\'',
            failed: true
        };
        // Issues disabled on repo, automatic should fail
        failed['test-other'] = {
            target: 'js-org-cleanup.github.io/test-repo-3',
            http: 'Failed with status code \'404 Not Found\'',
            https: 'Failed with status code \'404 Not Found\'',
            failed: true
        };
        // Repo doesn't exist, should fail on automatic contact
        failed['test-gone'] = {
            target: 'js-org-cleanup.github.io',
            http: 'Failed with status code \'404 Not Found\'',
            https: 'Failed with status code \'404 Not Found\'',
            failed: true
        };
        // External domain, shouldn't try automatic contact
        failed['custom'] = {
            target: 'custom-target.test.com',
            http: 'Failed with status code \'404 Not Found\'',
            https: 'Failed with status code \'404 Not Found\'',
            failed: true
        };
    }

    // Wait for confirmation
    let ans = '';
    while (ans.toString().toLowerCase().trim() !== 'confirm') {
        ans = await confirm('Enter \'confirm\' to begin creating issues...\n');
    }

    // Log
    log('\nResuming createMainIssue process', chalk.cyanBright.bold);

    // Create new empty issue (change this for DEV)
    const issue = await octokit.issues.create({
        owner: config.repository_owner,
        repo: config.repository_name,
        title: 'JS.ORG CLEANUP',
        body: 'Automatic initial cleanup contact in progress... this issue will be updated shortly.'
    });

    let pending = failed;
    let contact = {};
    if (config.automatic_contact) {
        // Attempt automatic contact
        logDown();
        const res = await attemptTargetIssues(failed, issue.data.html_url);
        logUp();

        // Get data
        pending = res.pending;
        contact = res.contact;

        // Log resume
        log('\nResuming createMainIssue process', chalk.cyanBright.bold);
    }

    // Convert them to MD list
    const pendingList = entriesToList(pending);
    const contactList = entriesToList(contact);

    // Generate the contents
    const contactIssue = await repoContactIssue(
        'xxx',
        { target: 'xxx', http: 'xxx', https: 'xxx' },
        issue.data.html_url,
        false);
    const tpl = await fs.readFileSync('templates/main_issue.md', 'utf8');
    const body = tpl
        .replace(/{{PENDING_LIST}}/g, pendingList.join('\n'))
        .replace(/{{CONTACT_LIST}}/g, contactList.join('\n'))
        .replace(/{{CONTACT_ISSUE}}/g, contactIssue);

    // Edit the issue
    await octokit.issues.update({
        owner: config.repository_owner,
        repo: config.repository_name,
        issue_number: issue.data.number,
        body
    });

    // Save to cache
    await setCache('createMainIssue', issue.data);

    // Reset cache
    log('  Issue updated with full list', chalk.green);
    log('  Purging cache before completion', chalk.blue);
    await removeCache('validateCNAMEs');
    await removeCache('attemptTargetIssues');

    // Done
    log('Issue creation completed for createMainIssue', chalk.greenBright.bold);
    return issue.data.html_url;
};

/**
 * Parses the given GitHub issue and returns all unchecked cleanup cname entries
 * @param {int} issueNumber - The cleanup issue to scan
 * @returns {Promise<Array<string>>}
 */
const parseIssueEntries = async issueNumber => {
    // Log
    log('\nStarting parseIssueCNAMEs process', chalk.cyanBright.bold);

    // Fetch any cache we have
    const cache = await getCache('parseIssueCNAMEs') || {};
    if (cache && issueNumber in cache) {
        log(`Cached data found for parseIssueCNAMEs w/ #${issueNumber}`, chalk.greenBright.bold);
        return cache[issueNumber];
    }

    // Get the issue body
    const issue = await octokit.issues.get({
        owner: config.repository_owner,
        repo: config.repository_name,
        issue_number: issueNumber
    });

    // Regex time
    const reg = new RegExp(/^- \[ ] \*\*(\S+?)\.js\.org\*\* > (\S+)$/gm);
    const badCNAMEs = [ ...issue.data.body.matchAll(reg) ].map(match => match[1]);

    // Cache
    cache[issueNumber] = badCNAMEs;
    await setCache('parseIssueCNAMEs', cache);

    // Done
    log('Parsing completed for parseIssueCNAMEs', chalk.greenBright.bold);
    return badCNAMEs;
};

// Export
module.exports = { createMainIssue, parseIssueEntries };
