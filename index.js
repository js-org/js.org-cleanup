// Load in chalk for logging
const chalk = require("chalk");

// Load in pr actions
const {perfectCNAMEsFile, mainCleanupPull} = require("./prs.js");

// Load in issue operations
const {createIssue} = require("./issues.js");

/**
 * Show an error message in console explaining the command line argument choices
 */
const showArgsError = () => {
    console.log(chalk.red("\nPlease provide one of the following command line arguments to run the cleanup script:"));
    console.log(chalk.red("  --perfect               : Generates a perfectly formatted and sorted cnames_active file"));
    console.log(chalk.red("  --main-issue            : Initiates the annual cleanup by creating the main cleanup issue"));
    console.log(chalk.red("  --main-pr <issueNumber> : Completes the annual cleanup by parsing issue and creating PR"));
    console.log(chalk.redBright.bold("\nCleanup script aborted"));
};

/**
 * Run the scripts based on command line argument provided
 * @returns {Promise<void>}
 */
const run = async () => {
    // Get args w/o node & file
    const args = process.argv.slice(2);

    // Validate args length
    if (!args) {
        showArgsError();
        return;
    }

    // Handle the args
    switch (args[0]) {
        case "--perfect":
            await perfectCNAMEsFile();
            break;
        case "--main-issue":
            await createIssue();
            break;
        case "--main-pr":
            if (args.length >= 2) {
                mainCleanupPull(args[1]);
                break;
            }
        default:
            showArgsError();
    }
};

run();
