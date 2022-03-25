// Load in custom logging
const { log } = require('./src/util/log');

// Load in chalk for logging
const chalk = require('chalk');

// Load in pr actions
const { perfectCNAMEsFile, mainCleanupPull } = require('./src/robot/prs');

// Load in issue operations
const { createMainIssue } = require('./src/robot/issues');

/**
 * Show an error message in console explaining the command line argument choices
 */
const showArgsError = () => {
    log('\nPlease provide one of the following command line arguments to run the cleanup script:', chalk.red);
    log('  --perfect               : Generates a perfectly formatted and sorted cnames_active file', chalk.red);
    log('  --main-issue            : Initiates the annual cleanup by creating the main cleanup issue', chalk.red);
    log('  --main-pr <issueNumber> : Completes the annual cleanup by parsing issue and creating PR', chalk.red);
    log('\nCleanup script aborted', chalk.redBright.bold);
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
        case '--perfect':
            log(await perfectCNAMEsFile());
            break;
        case '--main-issue':
            log(await createMainIssue());
            break;
        case '--main-pr':
            if (args.length >= 2) {
                log(await mainCleanupPull(parseInt(args[1])));
                break;
            }
        default:
            showArgsError();
    }
};

run();
