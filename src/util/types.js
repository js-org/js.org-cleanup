/**
 * @typedef {Object} cnameObject
 * @property {string} target - The CNAME target
 * @property {string} [noCF] - The noCF tag (if present) on the record
 *
 * @property {string} [http] - The status of the HTTP test (if failed)
 * @property {string} [https] - The status of the HTTPS test (if failed)
 * @property {boolean} [failed] - If the testing failed
 *
 * @property {Object} [issue] - The issue created through automatic cleanup contact
 * @property {boolean} [contact] - If automatic contact has been made
 */

/**
 * @typedef {Object.<string, cnameObject>} cnamesObject
 */

/**
 * @typedef {Object} cnamesValidationObject
 * @property {cnamesObject} failed - CNAME entires that failed validation
 * @property {cnamesObject} passed - CNAME entires that passed validation
 */

/**
 * @typedef {Object} cnamesAttemptedContact
 * @property {cnamesObject} pending - Any cname entries that could not be contacted automatically
 * @property {cnamesObject} contact - All cname entries that were automatically contacted
 */

/**
 * @typedef {Object} cnamesContext
 * @property {boolean} [actions] - If the current context is GitHub Actions
 * @property {string} [file] - The filename for the current context
 */
