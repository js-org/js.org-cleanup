// Load in custom logging
const { log } = require('./log');

// Load in chalk for logging
const chalk = require('chalk');

// Load custom jsdoc types
require('./types');

/**
 * Parse cnames data from provided cnames file content
 * @param {string} content - The cnames file content to parse
 * @returns {cnamesObject}
 */
const parseCNAMEsFile = (content) => {
    // Log
    log('\nStarting parseCNAMEsFile process', chalk.cyanBright.bold);

    // Regex time
    const reg = new RegExp(/[ \t]*['"](.*)['"][ \t]*:[ \t]*['"](.*)['"][ \t]*,?[ \t]*(\/\/ *[Nn][Oo][Cc][Ff].*)?[ \t]*\n/g);
    const cnames = {};
    let match;
    while ((match = reg.exec(content)) !== null) {
        cnames[match[1]] = {
            target: match[2],
            noCF: match[3] ? `// noCF${match[3].slice(2).trim().slice(4)}` : undefined,
        }
    }

    // Done
    log('Parsing completed for parseCNAMEsFile', chalk.greenBright.bold);
    return cnames;
};

/**
 * Create a perfectly formatted cnames_active file based on the data provided
 * @param {cnamesObject} cnames - The cnames data to use in the file
 * @param {string} file - The cnames file content to use
 * @returns {?string}
 */
const generateCNAMEsFile = (cnames, file) => {
    // Log
    log('\nStarting generateCNAMEsFile process', chalk.cyanBright.bold);

    // Regex time to find the top/bottom comment blocks
    const reg = new RegExp(/(\/\*[\S\s]+?\*\/)/g);
    const commentBlocks = [];
    let match;
    while ((match = reg.exec(file)) !== null) {
        commentBlocks.push(match[1]);
    }

    // Abort if couldn't find the top/bottom blocks
    if (commentBlocks.length < 2) {
        // Log
        log('  Could not locate top & bottom comment blocks in raw file', chalk.yellow);
        log('Generation aborted for generateCNAMEsFile', chalk.redBright.bold);
        return null;
    }
    log('  Comment blocks located in existing raw file', chalk.blue);

    // Get perfect alphabetical order
    cnames = Object.fromEntries(Object.entries(cnames).map(entry => [ entry[0].toLowerCase(), entry[1] ]));
    const cnamesKeys = Object.keys(cnames);
    cnamesKeys.sort();

    // Generate the new file entries
    const cnamesList = [];
    for (const i in cnamesKeys) {
        const cname = cnamesKeys[i];
        const data = cnames[cname];
        cnamesList.push(`  "${cname}": "${data.target}"${Number(i) === cnamesKeys.length - 1 ? '' : ','}${data.noCF ? ` ${data.noCF}` : ''}`)
    }

    // Format into the new file
    const content = `${commentBlocks[0]}\n\nvar cnames_active = {\n${cnamesList.join('\n')}\n  ${commentBlocks[1]}\n}\n`;

    // Done
    log('Generation completed for generateCNAMEsFile', chalk.greenBright.bold);
    return content
};

// Export
module.exports = { parseCNAMEsFile, generateCNAMEsFile };
