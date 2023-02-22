import fs from 'fs/promises'

/**
 * Parses and returns this project's package.json.
 * @returns {Object}
 */
export const packageInfo = JSON.parse(await fs.readFile('./package.json'))
