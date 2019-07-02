// Load in chalk for logging
const chalk = require("chalk");

// Load in CNAME operation
const {perfectCNAMEsFile} = require("./cnames.js");

// Load in issue operations
const {createIssue} = require("./issues.js");

/**
 * Show an error message in console explaining the command line argument choices
 */
const showArgsError = () => {
    console.log(chalk.red("\nPlease provide one of the following command line arguments to run the cleanup script:"));
    console.log(chalk.red("  --main    : Initiates the annual cleanup by creating the main cleanup issue"));
    console.log(chalk.red("  --perfect : Generates a perfectly formatted and sorted cnames_active file"));
    console.log(chalk.redBright.bold("\nCleanup script aborted"));
};

/**
 * Run the scripts based on command line argument provided
 * @returns {Promise<void>}
 */
const main = async () => {
    // Get args w/o node & file
    const args = process.argv.slice(2);

    // Validate args length
    if (!args) {
        showArgsError();
        return;
    }

    // Handle the args
    switch (args[0]) {
        case "--main":
            await createIssue();
            break;
        case "--perfect":
            await perfectCNAMEsFile();
            break;
        default:
            showArgsError();
    }
};

main();

// TODO: parse issue to detect entries that were not ticked
// TODO: remove un-ticked entries from the cnames_active file
// TODO: create PR to update cnames_active file (ref issue)
