// Load in custom logging
const { log } = require('./src/util/log');

// Load in chalk for logging
const chalk = require('chalk');

/**
 * Show an error message in console explaining the command line argument choices
 */
const showArgsError = () => {
    log('\nPlease provide one of the following command line arguments to run the cleanup script:', chalk.red);
    log('  --perfect               : Generates a perfectly formatted and sorted cnames_active file', chalk.red);
    log('  --main-issue            : Initiates the annual cleanup by creating the main cleanup issue', chalk.red);
    log('  --main-pr <issueNumber> : Completes the annual cleanup by parsing issue and creating PR', chalk.red);
    log('  --validate <filePath>   : Validates a given cnames_active file for perfect formatting', chalk.red);
    log('\nCleanup script aborted', chalk.redBright.bold);
};

/**
 * Run the scripts based on command line argument provided
 * @returns {Promise<void>}
 */
const run = async () => {
    // Get args w/o node & file
    const args = process.argv.slice(2);

    // Handle the args
    switch (args[0]) {
        case '--perfect':
            await require('./src/robot/prs').perfectCNAMEsFile();
            return;
        case '--main-issue':
            log(await require('./src/robot/issues').createMainIssue());
            return;
        case '--main-pr':
            if (args.length >= 2) {
                await require('./src/robot/prs').mainCleanupPull(parseInt(args[1]));
                return;
            }
        case '--validate':
            if (args.length >= 2) {
                require('./src/ci/validate').validateCNAMEsFile(args[1]);
                return;
            }
    }

    // Show error if no valid args provided
    showArgsError();
};

run().then(() => {}).catch(err => {
    console.error(err);
    process.exit(1);
});
