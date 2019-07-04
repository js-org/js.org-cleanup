// Load in chalk for logging
const chalk = require("chalk");

let logLevel = 0;

/*
 * TODO: Method to increase indent (use '>' to indicate level) of log messages
 */
const logDown = () => {
    logLevel++;
};

/*
 * TODO: Method to decrease indent level of log messages
 */
const logUp = () => {
    logLevel--;
    if (logLevel < 0) logLevel = 0;
};

/*
 * TODO: Method to log message, takes string and chalk color (callback essentially)
 *  This should make use of the indent level as controlled above
 */
const log = (message, chalkColor) => {
    const indent = chalk.grey(`${">".repeat(logLevel)}${logLevel === 0 ? "" : " "}`);
    const lines = message.split("\n");
    lines.forEach(line => {
        console.log(`${line ? indent : ""}${chalkColor(line)}`);
    });
};

// TODO: Use this new logging method for all logging in script
//  The aim being that this will make it visually easier to trace how methods are getting called in the stack

// Export
module.exports = {logDown, logUp, log};
