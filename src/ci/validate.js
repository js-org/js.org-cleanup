import fs from 'node:fs';
import { resolve } from 'node:path';

import chalk from 'chalk';
import { diffLines } from 'diff';

import { log, logDown, logUp } from '../util/log.js';
import { parseCNAMEsFile, generateCNAMEsFile } from '../util/cnames.js';

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
 * Log the final result of the validation with an appropriate exit code
 * @param {boolean} [success=true] - Whether the validation succeeded or failed
 */
const logExit = (success = true) => {
    log(`Validation ${success ? 'completed' : 'failed'} for validateCNAMEsFile`,
        success ? chalk.greenBright.bold : chalk.redBright.bold);
    process.exit(success ? 0 : 1);
};

/**
 * Validate the formatting and sorting of a cnames_active file
 * @param {string} file - File path for cnames_active file to validate
 * @param {boolean} fix - Fix the file instead of reporting errors
 */
export const validateCNAMEsFile = (file, fix) => {
    // Log
    log('\nStarting validateCNAMEsFile process', chalk.cyanBright.bold);

    // Create a context (for GitHub Actions)
    file = resolve(file);
    const context = {
        actions: !!process.env.GITHUB_ACTIONS,
        file: process.env.GITHUB_WORKSPACE && file.startsWith(process.env.GITHUB_WORKSPACE)
            ? file.substring(process.env.GITHUB_WORKSPACE.length + 1)
            : file,
    };

    // Read in the file
    logDown();
    const content = readCNAMEsFile(file);
    logUp();

    // Get the raw cnames
    logDown();
    const cnames = parseCNAMEsFile(content, context);
    if (!cnames) {
        logExit(false);
        return;
    }
    logUp();

    // Get the new file
    logDown();
    const newContent = generateCNAMEsFile(cnames, content);
    if (!newContent) {
        logExit(false);
        return;
    }
    logUp();

    // Log
    log('\nResuming validateCNAMEsFile process', chalk.cyanBright.bold);

    // Handle auto-fix
    if (fix) {
        fs.writeFileSync(file, newContent);
        log('\nFixed file written to disk for validateCNAMEsFile', chalk.greenBright.bold);
        return;
    }

    // Report diff
    let line = 0;
    const diffContent = diffLines(content, newContent);
    for (let i = 0; i < diffContent.length; i++) {
        const part = diffContent[i];
        const previousPart = i > 0 ? diffContent[i - 1] : null;
        const nextPart = i < diffContent.length - 1 ? diffContent[i + 1] : null;

        if (part.added || part.removed) {
            const partLines = part.value.slice(0, -1).split('\n');
            const previousPartLines = previousPart ? previousPart.value.slice(0, -1).split('\n') : null;
            const nextPartLines = nextPart ? nextPart.value.slice(0, -1).split('\n') : null;

            for (let j = 0; j < partLines.length; j++) {
                const partLine = partLines[j];

                if (part.added) {
                    if (previousPart && previousPart.removed && j < previousPartLines.length) {
                        // Other half of expected/found from below, don't log
                    } else {
                        log(`Line ${line}: Expected to find '${partLine}' after existing line`, chalk.redBright);
                        if (context.actions) console.log(`::error file=${context.file},line=${line}::Expected to find \`${partLine.replace(/`/g, '\\`')}\` after existing line`);
                    }
                } else {
                    if (nextPart && nextPart.added && j < nextPartLines.length) {
                        const nextPartLine = nextPartLines[j];
                        log(`Line ${line + 1}: Expected: '${nextPartLine}'`, chalk.redBright);
                        log(`${' '.repeat(Math.log10(line + 1) + 7)} Found:    '${partLine}'`, chalk.redBright);
                        if (context.actions) console.log(`::error file=${context.file},line=${line + 1}::Expected: \`${nextPartLine.replace(/`/g, '\\`')}\`%0A   Found: \`${partLine.replace(/`/g, '\\`')}\``);
                    } else {
                        log(`Line ${line + 1}: Expected no line, but found '${partLine}'`, chalk.redBright);
                        if (context.actions) console.log(`::error file=${context.file},line=${line + 1}::Expected no line, but found \`${partLine.replace(/`/g, '\\`')}\``);
                    }

                    // Increase line count if from old content
                    line++;
                }
            }
        }

        // Increase line count if from old content
        if (!part.added && !part.removed) line += part.value.slice(0, -1).split('\n').length;
    }

    // Done
    logExit(content === newContent);
};
