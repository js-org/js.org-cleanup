// Load in our config
const config = require("./config.json");

// Load in CNAME operation
const {perfectCNAMEsFile, validateCNAMEs} = require("./cnames.js");

// Load in issue operations
const {createMainIssue} = require("./issues.js");

/**
 * Fetches & validates all CNAME entries, formats them into the JS.org cleanup issue template
 */
const createIssue = async () => {
    // Get the failed CNAMEs
    const failed = await validateCNAMEs();

    // DEV: custom test failed record
    if (config.dev_fake_cnames) {
        // Clear out all the real cnames
        for (const cname in failed) {
            if (!failed.hasOwnProperty(cname)) continue;
            delete failed[cname];
        }
        // Should be able to create automatic contact issue
        failed["test"] = {
            target: "js-org-cleanup.github.io/test-repo-2",
            http: "Failed with status code '404 Not Found'",
            https: "Failed with status code '404 Not Found'",
            failed: true
        };
        // Issues disabled on repo, automatic should fail
        failed["test-other"] = {
            target: "js-org-cleanup.github.io/test-repo-3",
            http: "Failed with status code '404 Not Found'",
            https: "Failed with status code '404 Not Found'",
            failed: true
        };
        // Repo doesn't exist, should fail on automatic contact
        failed["test-gone"] = {
            target: "js-org-cleanup.github.io",
            http: "Failed with status code '404 Not Found'",
            https: "Failed with status code '404 Not Found'",
            failed: true
        };
        // External domain, shouldn't try automatic contact
        failed["custom"] = {
            target: "custom-target.test.com",
            http: "Failed with status code '404 Not Found'",
            https: "Failed with status code '404 Not Found'",
            failed: true
        };
    }

    console.log(await createMainIssue(failed));
};

perfectCNAMEsFile();

// TODO: as a secondary feature of the script, have just a file cleanup method
// TODO: will just parse all cnames, header/footer of the file, then generate perfectly formatted new file & pr

// TODO: parse issue to detect entries that were not ticked
// TODO: remove un-ticked entries from the cnames_active file
// TODO: create PR to update cnames_active file (ref issue)
