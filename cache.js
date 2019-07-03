// Load in fs for files
const fs = require("fs");

/**
 * Fetch cached data for the given function name
 * @param {string} name - Function name for cache
 * @returns {Promise<?*> | ?*}
 */
const getCache = async name => {
    const path = `cache/${name}.json`;
    if (!fs.existsSync(path)) return;
    const file = await fs.readFileSync(path, "utf8");
    if (!file) return;
    const data = JSON.parse(file);
    if (!data) return;
    return data;
};

/**
 * Sets the cached data for a given function name
 * @param {string} name - The function name to cache data for
 * @param {*} contents - The data to store
 * @returns {Promise<void>}
 */
const setCache = async (name, contents) => {
    if (!fs.existsSync("cache/")) {
        await fs.mkdirSync("cache")
    }
    const path = `cache/${name}.json`;
    const data = JSON.stringify(contents);
    await fs.writeFileSync(path, data);
};

/**
 * Removes the cached for a given function name
 * @param {string} name - The function name to remove cache for
 * @returns {Promise<void>}
 */
const removeCache = async name => {
    const path = `cache/${name}.json`;
    if (!fs.existsSync(path)) return;
    await fs.unlinkSync(path);
};

// Export
module.exports = {getCache, setCache, removeCache};
