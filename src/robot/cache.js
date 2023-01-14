// Load in fs for files
const fs = require('fs');

// Load in path joining
const { join, dirname } = require('path');

/**
 * Fetch cached data for the given function name
 * @param {string} name - Function name for cache
 * @returns {?*}
 */
const getCache = name => {
    const path = join(__dirname, '..', '..', 'cache', `${name}.json`);
    if (!fs.existsSync(path)) return null;
    const file = fs.readFileSync(path, 'utf8');
    if (!file) return null;
    try {
        return JSON.parse(file);
    } catch {
        return null;
    }
};

/**
 * Sets the cached data for a given function name
 * @param {string} name - The function name to cache data for
 * @param {*} contents - The data to store
 */
const setCache = (name, contents) => {
    const path = join(__dirname, '..', '..', 'cache', `${name}.json`);
    if (!fs.existsSync(dirname(path))) fs.mkdirSync(dirname(path));
    const data = JSON.stringify(contents);
    fs.writeFileSync(path, data);
};

/**
 * Removes the cached for a given function name
 * @param {string} name - The function name to remove cache for
 */
const removeCache = name => {
    const path = join(__dirname, '..', '..', 'cache', `${name}.json`);
    if (!fs.existsSync(path)) return;
    fs.unlinkSync(path);
};

// Export
module.exports = { getCache, setCache, removeCache };
