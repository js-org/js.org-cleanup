import chalk from 'chalk';

import { log } from './src/util/log.js';

/**
 * Show an error message in console explaining the command line argument choices
 */
const showArgsError = () => {
    log('\nPlease provide one of the following command line arguments to run the cleanup script:', chalk.red);
    log('  --perfect                     : Generates a perfectly formatted and sorted cnames_active file', chalk.red);
    log('  --main-issue                  : Initiates the annual cleanup by creating the main cleanup issue', chalk.red);
    log('  --main-pr <issueNumber>       : Completes the annual cleanup by parsing issue and creating PR', chalk.red);
    log('  --validate <filePath> [--fix] : Validates a given cnames_active file for perfect formatting', chalk.red);
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
            await import('./src/robot/prs.js').then(exports => exports.perfectCNAMEsFile());
            return;
        case '--main-issue':
            log(await import('./src/robot/issues.js').then(exports => exports.createMainIssue()));
            return;
        case '--main-pr':
            if (args.length >= 2) {
                await import('./src/robot/prs.js').then(exports => exports.mainCleanupPull(parseInt(args[1])));
                return;
            }
        case '--validate':
            if (args.length >= 2) {
                await import('./src/ci/validate.js').then(exports => exports.validateCNAMEsFile(args[1], args[2] === '--fix'));
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
