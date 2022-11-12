// Load in custom logging
const { log } = require('./log');

// Load in chalk for logging
const chalk = require('chalk');

// Load custom jsdoc types
require('./types');

/**
 * Parse cnames data from provided cnames file content
 * @param {string} content - The cnames file content to parse
 * @param {cnamesContext} [context={}] - The context for parsing, such as GitHub Actions
 * @returns {?cnamesObject}
 */
const parseCNAMEsFile = (content, context = {}) => {
    // Log
    log('\nStarting parseCNAMEsFile process', chalk.cyanBright.bold);

    const lines = content.split('\n');

    // Locate var line
    const varLine = lines.findIndex(line => /^var cnames_active = {[ \t]*$/.test(line));
    if (varLine === -1) {
        // Log
        log('  Could not locate the var declaration for cnames_active object', chalk.yellow);
        log('Parsing aborted for parseCNAMEsFile', chalk.redBright.bold);
        return null;
    }

    // Locate the closing comment + bracket
    const closingLine = lines.findIndex((_, idx) => idx > varLine &&
        /^[ \t]*\/\*[\S\s]+?\*\/[ \t]*\n};?[ \t]*(\n|$)/.test(lines.slice(idx).join('\n')));
    if (closingLine === -1) {
        // Log
        log('  Could not locate the closing comment and curly bracket for cnames_active object', chalk.yellow);
        log('Parsing aborted for parseCNAMEsFile', chalk.redBright.bold);
        return null;
    }

    // Regex time
    const reg = new RegExp(/^[ \t]*['"]([a-z0-9-_.]*)['"][ \t]*:[ \t]*['"]([^"]*)['"][ \t]*,?[ \t]*(\/\/ *nocf.*)?[ \t]*$/i);
    const cnames = {};
    for (let i = varLine + 1; i < closingLine; i++) {
        const line = lines[i];
        const match = line.match(reg);

        if (!match) {
            log(`  Line ${i + 1}: Failed to parse '${line}' as cnames_active entry`, chalk.yellow);
            if (context.actions) console.log(`::warning file=${context.file},line=${i + 1}::Failed to parse \`${line.replace(/`/g, '\\`')}\` as cnames_active entry`);
            continue;
        }

        // Subdomains are always lowercase
        let subdomain = match[1].toLowerCase();

        // Drop any js.org suffix
        subdomain = subdomain.replace(/\.js\.org$/, '');

        // Drop trailing slashes
        let target = match[2].replace(/\/+$/, '');

        // Drop http(s)://
        const urlMatch = target.match(/^(?:https?:)?\/\/(.+)$/i);
        if (urlMatch) target = urlMatch[1];

        // Convert github.com to github.io
        const githubComMatch = target.match(/^github\.com\/([^/]+)\/(.+)$/i);
        if (githubComMatch) target = `${githubComMatch[1]}.github.io/${githubComMatch[2]}`;

        // Remove any paths that aren't github.io
        const githubIoMatch = target.match(/^[^.]+\.github\.io\/[^/]+$/i);
        const hasPathMatch = target.match(/^([^/]+)\/(.+)$/);
        if (!githubIoMatch && hasPathMatch) target = hasPathMatch[1];

        // Convert vercel.app to cname.vercel-dns.com
        if (target.endsWith('.vercel.app')) target = 'cname.vercel-dns.com';

        // Ensure hostname is lowercase
        const hostnameMatch = target.match(/^([^/]+)(.*)$/);
        if (hostnameMatch) target = `${hostnameMatch[1].toLowerCase()}${hostnameMatch[2]}`;

        // Ensure consistent noCF flag
        let noCF = match[3] ? `// noCF${match[3].slice(2).trim().slice(4)}` : undefined;

        // Any sub-sub-domains must use noCF
        if (subdomain.includes('.')) noCF = noCF || '// noCF';

        // Any Vercel subdomains must use noCF
        if (target === 'cname.vercel-dns.com') noCF = noCF || '// noCF';

        cnames[subdomain] = {
            target,
            noCF,
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
