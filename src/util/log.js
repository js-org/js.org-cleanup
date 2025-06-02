import chalk from 'chalk';

// The global log level
let logLevel = 0;

/**
 * Increases the depth of future log messages
 */
export const logDown = () => {
    logLevel++;
};


/**
 * Decreases the depth of log messages
 */
export const logUp = () => {
    logLevel--;
    if (logLevel < 0) logLevel = 0;
};

/**
 * This logs a message at the current depth using the given color
 * Empty lines will be logged without indentation
 * @param {string} message - The message to be logged
 * @param {(...text: unknown[]) => string} [chalkColor=chalk.default] - The chalk color that will be used
 */
export const log = (message, chalkColor) => {
    if (typeof message !== 'string') return;
    if (chalkColor === undefined) chalkColor = chalk.default;
    const indent = chalk.grey(`${'>'.repeat(logLevel)}${logLevel === 0 ? '' : ' '}`);
    const lines = message.split('\n');
    lines.forEach(line => {
        console.log(`${line ? indent : ''}${chalkColor(line)}`);
    });
};
