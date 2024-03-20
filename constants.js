import fs from 'fs/promises'
import { dirname, sep } from 'path'
import { fileURLToPath } from 'url'

import chalk from 'chalk'

/**
 * Path to the library.
 * @constant
 */
export const BASE_PATH = dirname(fileURLToPath(import.meta.url))

/**
 * Path to the fixtures folder.
 * @constant
 */
export const FIXTURES_PATH = `${BASE_PATH}${sep}fixtures${sep}`

/**
 * Path to the fixtures folder pages sub-directory.
 * @constant
 */
export const PAGES_DIR_FIXTURES_PATH = `${FIXTURES_PATH}pages${sep}`

/**
 * Path to the pages.jsonl fixture
 * @constant
 */
export const PAGES_FIXTURE_PATH = `${PAGES_DIR_FIXTURES_PATH}pages.jsonl`

/**
 * Path to the extraPages.jsonl fixture
 * @constant
 */
export const EXTRA_PAGES_FIXTURE_PATH = `${PAGES_DIR_FIXTURES_PATH}extraPages.jsonl`

/**
 * Colors scheme for log level.
 * @constant
 */
export const LOGGING_COLORS = {
  DEFAULT: chalk.gray,
  TRACE: chalk.magenta,
  DEBUG: chalk.cyan,
  INFO: chalk.blue,
  WARN: chalk.yellow,
  ERROR: chalk.red
}

/**
 * This project's package.json as a frozen object.
 * @constant
 * @type {Object}
 */
export const PACKAGE_INFO = Object.freeze(
  JSON.parse(await fs.readFile(`${BASE_PATH}${sep}package.json`))
)
