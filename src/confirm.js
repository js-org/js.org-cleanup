const readline = require("readline");

/**
 * Asks the query in the shell and returns the response
 * @param {string} query - The query to ask in shell
 * @returns {Promise<string>}
 */
module.exports = query => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
};
