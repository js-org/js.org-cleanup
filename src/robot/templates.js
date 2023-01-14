// Load in our config
const config = require('../../config.json');

// Load in fs for files
const fs = require('fs');

// Load in path joining
const { join } = require('path');

// Load custom jsdoc types
require('../util/types');

/**
 * Generates the robot disclaimer
 * @returns {string}
 */
const robotDisclaimer = () => {
    const template = fs.readFileSync(join(__dirname, '..', '..', 'templates', 'bot_disclaimer.md'), 'utf8');
    return template
        .replace(/{{REPO_OWNER}}/g, config.repository_owner)
        .replace(/{{REPO_NAME}}/g, config.repository_name);
};

/**
 * Generates the issue body for the cname entry to be contacted
 * @param {string} cname - The cname of the entry being contacted
 * @param {cnameObject} data - The data for the cname given
 * @param {string} issue - The URL of the main cleanup issue
 * @param {boolean} robot - Indicates the robot disclaimer should be applied
 * @returns {string}
 */
const repoContactIssue = (cname, data, issue, robot) => {
    const template = fs.readFileSync(join(__dirname, '..', '..', 'templates', 'contact_issue.md'), 'utf8');
    const body = template
        .replace(/{{CNAME}}/g, cname)
        .replace(/{{TARGET}}/g, data.target)
        .replace(/{{HTTP}}/g, data.http || 'Okay')
        .replace(/{{HTTPS}}/g, data.https || 'Okay')
        .replace(/{{ISSUE}}/g, issue);
    return `${body}${robot ? `${robotDisclaimer()}` : ''}`;
};

/**
 * Creates the body of the main cleanup process pull request
 * @param {int} issueNumber - The associated cleanup issue number
 * @param {Array<string>} stillBadCNAMEs - Bad cnames being removed
 * @param {Array<string>} notBadCNAMEs - Bad cnames not being removed
 * @returns {string}
 */
const mainPullRequest = async (issueNumber, stillBadCNAMEs, notBadCNAMEs) => {
    const template = fs.readFileSync(join(__dirname, '..', '..', 'templates', 'main_pr.md'), 'utf8');
    const body = template
        .replace(/{{ISSUE_URL}}/g, `https://github.com/${config.repository_owner}/${config.repository_name}/issues/${issueNumber}`)
        .replace(/{{ISSUE_NUMBER}}/g, issueNumber)
        .replace(/{{STILL_BAD_CNAMES}}/g, stillBadCNAMEs.map(x => ` - [${x}.js.org](http://${x}.js.org)`).join('\n') || '*None*')
        .replace(/{{NOT_BAD_CNAMES}}/g, notBadCNAMEs.map(x => ` - [${x}.js.org](http://${x}.js.org)`).join('\n') || '*None*');
    return `${body}${robotDisclaimer()}`;
};

// Export
module.exports = { robotDisclaimer, repoContactIssue, mainPullRequest };
