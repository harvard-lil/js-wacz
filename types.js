/**
 * Options that can be provided to the WACZ class.
 * @typedef {Object} WACZOptions
 * @property {string|string[]} input - Required. Path(s) to input .warc or .warc.gz file(s). Glob-compatible.
 * @property {string} output - Required. Path to output .wacz file. Will default to PWD + `archive.wacz` if not provided.
 * @property {boolean} [indexFromWARCs=true] - If true, will attempt to generate CDXJ indexes from processed WARCs. Automatically disabled if `cdjx` is passed or `addCDXJ()` is called.
 * @property {boolean} [detectPages=true] - If true (default), will attempt to detect pages in WARC records to generate a pages.jsonl file. Automatically disabled if: `pages`/ `cdxj` is provided, or `addPages()`/ `addCDJX()` is called.
 * @property {?string} url - If set, will be added to datapackage.json as `mainPageUrl`.
 * @property {?string} ts - If set, will be added to datapackage.json as `mainPageDate`. Can be any value that `Date()` can parse.
 * @property {?string} title - If set, will be added to datapackage.json as `title`.
 * @property {?string} description - If set, will be added to datapackage.json as `description`.
 * @property {?string} signingUrl - If set, will be used to try and sign the resulting archive.
 * @property {?string} signingToken - Access token to be used in combination with `signingUrl`.
 * @property {?Object} datapackageExtras - If set, will be appended to datapackage.json under `extras`.
 * @property {?string} cdxj - If set, skips indexing and allows for passing CDXJ files "as is". Path to a folder containing CDXJ files. Allows
 * @property {?string} pages - If set, allows for passing pre-set pages.jsonl file(s). Path to a folder containing pages files (pages.jsonl, extraPages.jsonl ...).
 * @property {?any} log - Will be used instead of the Console API for logging, if compatible (i.e: loglevel). Defaults to globalThis.console.
 */

/**
 * Represents a single entry to be added in a pages.jsonl file.
 * @typedef {Object} WACZPage
 * @property {string} id
 * @property {string} url
 * @property {string} title
 * @property {string} ts - Timestamp as ISO date. Example: "2023-02-22T16:19:54Z".
 */

/**
 * Represents an entry of "resources" in datapackage.json.
 * @typedef {Object} WACZDatapackageResource
 * @property {string} name - Basename of the file
 * @property {string} path - Path to the file from within the WACZ file.
 * @property {string} hash - Recommended: prepend the hash with the algorith used (i.e: "sha256:<hash>")
 * @property {number} bytes - Size of the file, in bytes.
 */
