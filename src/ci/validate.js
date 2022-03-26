// Load in custom logging
const { log, logDown, logUp } = require('../util/log');

// Load in all the cnames stuff
const { parseCNAMEsFile, generateCNAMEsFile } = require('../util/cnames');

// Load in chalk for logging
const chalk = require('chalk');

// Load in fs for files
const fs = require('fs');

// Load in diff for comparing files
const diff = require('diff');

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

    // Report diff
    let line = 0;
    const diffContent = diff.diffLines(content, newContent);
    for (let i = 0; i < diffContent.length; i++) {
        const part = diffContent[i];
        const previousPart = i > 0 ? diffContent[i - 1] : null;

        if (part.added || part.removed) {
            const partLines = part.value.slice(0, -1).split('\n');
            const previousPartLines = previousPart ? previousPart.value.slice(0, -1).split('\n') : null;

            for (let j = 0; j < partLines.length; j++) {
                const partLine = partLines[j];

                if (part.added) {
                    if (previousPart && previousPart.removed && j < previousPartLines.length) {
                        const previousPartLine = previousPartLines[j];
                        log(`Line ${line + 1}: Expected: '${partLine}'`, chalk.redBright);
                        log(`${' '.repeat(Math.log10(line + 1) + 7)} Found:    '${previousPartLine}'`, chalk.redBright);
                    } else {
                        log(`Line ${line}: Expected to find '${partLine}' after existing line`, chalk.redBright);
                    }
                } else {
                    log(`Line ${line + 1}: Expected no line, but found '${partLine}'`, chalk.redBright);

                    // Increase line count if from old content
                    line++;
                }
            }
        }

        // Increase line count if from old content
        if (!part.added && !part.removed) line += part.value.slice(0, -1).split('\n').length;
    }

    // Done
    const fail = content !== newContent;
    log(`Validation ${fail ? 'failed' : 'completed'} for validateCNAMEsFile`,
        fail ? chalk.redBright.bold : chalk.greenBright.bold);
    process.exit(fail ? 1 : 0);
};

// Export
module.exports = { validateCNAMEsFile };
