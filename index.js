// Load in CNAME operation
const {validateCNAMEs} = require("./cnames.js");

// Load in issue operations
const {createMainIssue} = require("./issues.js");

/**
 * Fetches & validates all CNAME entries, formats them into the JS.org cleanup issue template
 */
const createIssue = async () => {
    // Get the failed CNAMEs
    const failed = await validateCNAMEs();

    // DEV: custom test failed record
    for (const cname in failed) {
        if (!failed.hasOwnProperty(cname)) continue;
        delete failed[cname];
    }
    failed["test"] = {
        target: "js-org-cleanup.github.io/test-repo-2",
        http: "Failed with status code '404 Not Found'",
        https: "Failed with status code '404 Not Found'",
        failed: true
    };
    failed["custom"] = {
        target: "custom-target.test.com",
        http: "Failed with status code '404 Not Found'",
        https: "Failed with status code '404 Not Found'",
        failed: true
    };

    console.log(await createMainIssue(failed));
};

createIssue();

// TODO: parse issue to detect entries that were not ticked
// TODO: remove un-ticked entries from the cnames_active file
// TODO: create PR to update cnames_active file (ref issue)
