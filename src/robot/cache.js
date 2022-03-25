// Load in fs for files
const fs = require('fs');

// Load in path joining
const { join } = require('path');

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
    const data = JSON.parse(file);
    if (!data) return null;
    return data;
};

/**
 * Sets the cached data for a given function name
 * @param {string} name - The function name to cache data for
 * @param {*} contents - The data to store
 */
const setCache = (name, contents) => {
    if (!fs.existsSync(join(__dirname, '..', '..', 'cache'))) fs.mkdirSync('cache')
    const path = join(__dirname, '..', 'cache', `${name}.json`);
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
