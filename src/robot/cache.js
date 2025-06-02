import fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fetch cached data for the given function name
 * @param {string} name - Function name for cache
 * @returns {?*}
 */
export const getCache = name => {
    const path = new URL(`../../cache/${name}.json`, import.meta.url);
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
export const setCache = (name, contents) => {
    const path = new URL(`../../cache/${name}.json`, import.meta.url);
    const pathDir = dirname(fileURLToPath(path));
    if (!fs.existsSync(pathDir)) fs.mkdirSync(pathDir);
    const data = JSON.stringify(contents);
    fs.writeFileSync(path, data);
};

/**
 * Removes the cached for a given function name
 * @param {string} name - The function name to remove cache for
 */
export const removeCache = name => {
    const path = new URL(`../../cache/${name}.json`, import.meta.url);
    if (!fs.existsSync(path)) return;
    fs.unlinkSync(path);
};
