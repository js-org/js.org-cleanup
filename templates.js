// Load in our config
const config = require("./config.json");

// Load in fs for files
const fs = require("fs");

// Load custom jsdoc types
require("./types.js");

/**
 * Generates the robot disclaimer
 * @returns {Promise<string>}
 */
const robotDisclaimer = async () => {
    const template = await fs.readFileSync("templates/bot_disclaimer.md", "utf8");
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
 * @returns {Promise<string>}
 */
const repoContactIssue = async (cname, data, issue, robot) => {
    const template = await fs.readFileSync("templates/contact_issue.md", "utf8");
    const body = template
        .replace(/{{CNAME}}/g, cname)
        .replace(/{{TARGET}}/g, data.target)
        .replace(/{{HTTP}}/g, data.http)
        .replace(/{{HTTPS}}/g, data.https)
        .replace(/{{ISSUE}}/g, issue);
    return `${body}${robot ? `${await robotDisclaimer()}` : ""}`;
};

// Export
module.exports = {robotDisclaimer, repoContactIssue};
