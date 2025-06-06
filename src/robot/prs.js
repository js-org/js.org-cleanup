import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import { createPullRequest } from 'octokit-plugin-create-pull-request';

import { logDown, logUp, log } from '../util/log.js';
import { getCache, setCache, removeCache } from './cache.js';
import { getCNAMEsFile, validateCNAMEs } from './cnames.js';
import { parseCNAMEsFile, generateCNAMEsFile } from '../util/cnames.js';
import { robotDisclaimer, mainPullRequest } from './templates.js';
import { parseIssueEntries } from './issues.js';
import config from '../../config.json' with { type: 'json' };

const octokit = new (Octokit.plugin(createPullRequest))({ auth: config.github_token });

/**
 * Generates a perfect cnames_active.js file w/ pull request
 * @returns {Promise<void>}
 */
export const perfectCNAMEsFile = async () => {
    // Log
    log('\nStarting perfectCNAMEsFile process', chalk.cyanBright.bold);

    // Get the original file
    logDown();
    const file = await getCNAMEsFile();
    logUp();

    // Get the raw cnames
    logDown();
    const cnames = parseCNAMEsFile(file);
    if (!cnames) return;
    logUp();

    // Get the new file
    logDown();
    const newFile = generateCNAMEsFile(cnames, file);
    if (!newFile) return;
    logUp();

    // Log
    log('\nResuming perfectCNAMEsFile process', chalk.cyanBright.bold);

    // Compare
    if (newFile === file) {
        // Done
        log('  Existing file is already perfect, no changes', chalk.green);
        log('Generation completed for perfectCNAMEsFile', chalk.greenBright.bold);
        return;
    }

    // Create fork, commit & PR
    log('  Changes are required to make the file perfect', chalk.yellow);
    log('  Creating pull request with changes...', chalk.blue);
    const pr = await octokit.createPullRequest({
        owner: config.repository_owner,
        repo: config.repository_name,
        title: 'Cleanup: Perfect Format & Sorting',
        body: `This pull request cleans up the cnames_active.js file by ensuring the formatting and sorting is perfect.${robotDisclaimer()}`,
        head: 'cleanup-perfect',
        changes: {
            files: {
                'cnames_active.js': newFile
            },
            commit: 'Cleanup: Perfect Format & Sorting'
        },
        update: true
    });

    // Done
    log('    ...pull request created', chalk.green);
    log('Generation completed for perfectCNAMEsFile', chalk.greenBright.bold);
    return pr.data.html_url;
};

/**
 * Creates the main cleanup process final pull request based on the given cleanup issue number
 * @param {int} issueNumber - The cleanup issue to parse for bad cname entries
 * @returns {Promise<void>}
 */
export const mainCleanupPull = async issueNumber => {
    // Log
    log('\nStarting mainCleanupPull process', chalk.cyanBright.bold);

    // Fetch any cache we have
    const cache = await getCache('mainCleanupPull');
    if (cache) {
        log('Cached data found for mainCleanupPull', chalk.greenBright.bold);
        return cache.html_url;
    }

    // Lock issue
    log('  Locking cleanup issue...', chalk.blue);
    try {
        await octokit.rest.issues.lock({
            owner: config.repository_owner,
            repo: config.repository_name,
            issue_number: issueNumber
        });
        log('    ...issue locked', chalk.green);
    } catch (_) {
        log('    ...failed to lock issue', chalk.red);
    }

    // Get the file so we only need to fetch once
    logDown();
    const file = await getCNAMEsFile();
    logUp();

    // Get the raw cnames
    logDown();
    const allCNAMEs = parseCNAMEsFile(file);
    if (!allCNAMEs) return;
    logUp();

    // Get the bad cnames (convert to fake cnamesObject)
    logDown();
    const badCNAMEs = (await parseIssueEntries(issueNumber)).reduce(function (result, item) {
        result[item] = {};
        return result;
    }, {});
    log(`  Found ${Object.keys(badCNAMEs).length} CNAMEs unchecked in issue`, chalk.blue);
    logUp();

    // Check the bad cnames are still bad
    logDown();
    const validation = await validateCNAMEs(badCNAMEs);
    const stillBadCNAMEs = validation.failed;
    const notBadCNAMEs = validation.passed;
    log(`  Found ${Object.keys(stillBadCNAMEs).length} CNAMEs still failing`, chalk.blue);
    log(`  Found ${Object.keys(notBadCNAMEs).length} CNAMEs now working`, chalk.blue);
    logUp();

    // Log
    log('\nResuming mainCleanupPull process', chalk.cyanBright.bold);

    // Generate new cname data w/o bad cnames
    const newCNAMEs = {};
    for (const cname in allCNAMEs) {
        if (!allCNAMEs.hasOwnProperty(cname)) continue;
        if (stillBadCNAMEs.hasOwnProperty(cname)) {
            log(`  Removed ${cname} from cnames_active`, chalk.blue);
            continue;
        }
        newCNAMEs[cname] = allCNAMEs[cname];
    }
    log(`  Removed ${Object.keys(allCNAMEs).length - Object.keys(newCNAMEs).length} CNAMEs from cnames_active`, chalk.blue);

    // Generate new cnames_active
    logDown();
    const cnamesActive = generateCNAMEsFile(newCNAMEs, file);
    if (!cnamesActive) return;
    logUp();

    // Log
    log('\nResuming mainCleanupPull process', chalk.cyanBright.bold);

    // Create PR info
    const body = mainPullRequest(issueNumber, Object.keys(stillBadCNAMEs), Object.keys(notBadCNAMEs));
    const name = `JS.ORG CLEANUP (#${issueNumber})`;

    // Make pull request
    log('  Creating pull request with changes...', chalk.blue);
    const pr = await octokit.createPullRequest({
        owner: config.repository_owner,
        repo: config.repository_name,
        title: name,
        body,
        head: `cleanup-${new Date().toISOString().split('T')[0]}`,
        changes: {
            files: {
                'cnames_active.js': cnamesActive
            },
            commit: name
        }
    });
    log('    ...pull request created', chalk.green);

    // Save to cache
    setCache('mainCleanupPull', pr.data);

    // Reset cache
    log('  Purging cache before completion', chalk.blue);
    removeCache('validateCNAMEs');
    removeCache('parseIssueCNAMEs');

    // Done
    log('Generation completed for mainCleanupPull', chalk.greenBright.bold);
    return pr.data.html_url;
};
