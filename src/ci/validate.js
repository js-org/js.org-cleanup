// Load in custom logging
const { log, logDown, logUp } = require('../util/log');

// Load in all the cnames stuff
const { parseCNAMEsFile, generateCNAMEsFile } = require('../util/cnames');

// Load in chalk for logging
const chalk = require('chalk');

// Load in fs for files
const fs = require('fs');

/**
 * Read in a cnames_active file content from a provided file path
 * @param {string} file - File path for cnames_active file to read
 * @return {string}
 */
const readCNAMEsFile = (file) => {
    // Log
    log('\nStarting readCNAMEsFile process', chalk.cyanBright.bold);

    // Read in the file
    const fileContents = fs.readFileSync(file, 'utf8');

    // Done
    log('Reading completed for readCNAMEsFile', chalk.greenBright.bold);
    return fileContents;
};

/**
 * Validate the formatting and sorting of a cnames_active file
 * @param {string} file - File path for cnames_active file to validate
 */
const validateCNAMEsFile = (file) => {
    // Log
    log('\nStarting validateCNAMEsFile process', chalk.cyanBright.bold);

    // Read in the file
    logDown();
    const content = readCNAMEsFile(file);
    logUp();

    // Get the raw cnames
    logDown();
    const cnames = parseCNAMEsFile(content);
    logUp();

    // Get the new file
    logDown();
    const newContent = generateCNAMEsFile(cnames, content);
    logUp();

    // Log
    log('\nResuming validateCNAMEsFile process', chalk.cyanBright.bold);

    // TODO: Check diff
    // TODO: Report diff
    // TODO: Exit status
};

// Export
module.exports = { validateCNAMEsFile };
