// Load in chalk for logging
const chalk = require("chalk");

// The global log level
let logLevel = 0;

/**
 * Increases the depth of future log messages
 */
const logDown = () => {
    logLevel++;
};


/**
 * Decreases the depth of log messages
 */
const logUp = () => {
    logLevel--;
    if (logLevel < 0) logLevel = 0;
};

/**
 * This logs a message at the current depth using the given color
 * Empty lines will be logged without indentation
 * @param {string} message - The message to be logged
 * @param {function} [chalkColor=chalk.default] - The chalk color that will be used
 */
const log = (message, chalkColor) => {
    if (typeof message !== 'string') return;
    if (chalkColor === undefined) chalkColor = chalk.default;
    const indent = chalk.grey(`${">".repeat(logLevel)}${logLevel === 0 ? "" : " "}`);
    const lines = message.split("\n");
    lines.forEach(line => {
        console.log(`${line ? indent : ""}${chalkColor(line)}`);
    });
};

// Export
module.exports = {logDown, logUp, log};
