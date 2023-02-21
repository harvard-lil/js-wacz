import fs from 'fs/promises'
import { constants as fsConstants } from 'node:fs'
import { createWriteStream, createReadStream, WriteStream, unlinkSync } from 'fs'
import { createHash } from 'crypto'
import { basename, sep } from 'path'

import { Deflate } from 'pako'
import glob from 'glob'
import BTree from 'sorted-btree'
import { Piscina } from 'piscina'
import Archiver from 'archiver'

/// <reference path="types.js" />

/**
 * IDX to CDX ratio for ZipNum Shared Index.
 * For X entries in the CDX, there will be 1 in the IDX.
 * See: https://pywb.readthedocs.io/en/latest/manual/indexing.html#zipnum-sharded-index
 * @constant
 * @type {number}
 */
export const ZIP_NUM_SHARED_INDEX_LIMIT = 3000

/**
 *
 */
export class WACZ {
  /** @type {Console} */
  log = console

  /**
   * If `true`, enough information was provided for processing to go on.
   * @type {boolean}
   */
  ready = false

  /**
   * Worker pool for the `indexWARC` function.
   * @type {?Piscina}
   */
  indexWARCPool = null

  /**
   * From WACZOptions.file.
   * @type {?string}
   */
  file = null

  /**
   * From WACZOptions.output.
   * @type {?string}
   */
  output = null

  /**
   * From WACZOptions.detectPages.
   * @type {boolean}
   */
  detectPages = true

  /**
   * From WACZOptions.url.
   * @type {?string}
   */
  url = null

  /**
   * From WACZOptions.ts.
   * @type {?string}
   */
  ts = new Date().toISOString()

  /**
   * From WACZOptions.title.
   * @type {?string}
   */
  title = null

  /**
   * From WACZOptions.description.
   * @type {?string}
   */
  description = null

  /**
   * From WACZOptions.signingUrl.
   * @type {?string}
   */
  signingUrl = null

  /**
   * From WACZOptions.signingToken.
   * @type {?string}
   */
  signingToken = null

  /**
   * From WACZOptions.datapackageExtras. Stringified.
   * @type {?string}
   */
  datapackageExtras = {}

  /**
   * List of files detected from path provided in `file`.
   * @type {string[]}
   */
  WARCs = []

  /**
   * B-Tree in which the key is a CDXJ string and the value is a boolean.
   * Used for "sorting on the go".
   * @type {BTree}
   */
  cdxTree = new BTree.default() // eslint-disable-line

  /** @type {string[]} */
  cdxArray = []

  /**
   * B-Tree in which the key is an url string and the value is WACZPage.
   * Used for "sorting on the go".
   * @type {BTree}
   */
  pagesTree = new BTree.default() // eslint-disable-line

  /** @type {WACZPage[]} */
  pagesArray = []

  /** @type {WACZDatapackageResource[]} */
  filesInfo = []

  /**
   * Stream to output file. To be used by `this.archive`.
   * @type {?WriteStream}
   */
  outputStream = null

  /**
   * Writeable ZIP stream.
   * @type {?Archiver}
   */
  archiveStream = null

  /**
   * @param {WACZOptions} options
   */
  constructor (options = {}) {
    // Although non-blocking, options.log must be processed first
    if (options?.log) {
      this.log = options.log

      if (typeof this.log.trace !== 'function' ||
          typeof this.log.info !== 'function' ||
          typeof this.log.warn !== 'function' ||
          typeof this.log.error !== 'function'
      ) {
        throw new Error('"logger" must be compatible with the Console API.')
      }
    }

    this.filterBlockingOptions(options)
    this.filterNonBlockingOptions(options)
    this.ready = true

    this.initOutputStreams()
    this.initWorkerPool()
  }

  /**
   * Processes "blocking" options, which can't be skipped.
   * @throws
   * @param {WACZOptions} options
   */
  filterBlockingOptions = (options) => {
    const log = this.log

    // options.file
    try {
      if (!options?.file) {
        throw new Error('`file` was not provided.')
      }

      this.file = String(options.file).trim()
      const results = glob.sync(this.file)

      for (const file of results) {
        const filename = basename(file).toLowerCase()

        if (!filename.endsWith('.warc') && !filename.endsWith('.warc.gz')) {
          this.log.trace(`${file} found ignored.`)
          continue
        }

        this.WARCs.push(file)
      }

      if (this.WARCs.length < 1) {
        throw new Error('No WARC found.')
      }
    } catch (err) {
      log.trace(err)
      throw new Error('"file" must be a valid path leading to at least 1 .warc or .warc.gz file.')
    }

    // options.output
    try {
      this.output = options?.output
        ? String(options.output).trim()
        : `${process.env.PWD}${sep}archive.wacz`

      // Path must end by `.wacz`
      if (!this.output.toLocaleLowerCase().endsWith('.wacz')) {
        throw new Error('"output" must end with .wacz.')
      }

      // Delete existing file, if any
      try {
        unlinkSync(this.output) // [!] We can't use async version here (constructor)
      } catch (_err) { }
    } catch (err) {
      log.trace(err)
      throw new Error('"output" must be a valid "*.wacz" path on which the program can write.')
    }
  }

  /**
   * Processes "non-blocking" options for which we automatically switch to defaults or skip.
   * @param {WACZOptions} options
   */
  filterNonBlockingOptions = (options) => {
    const log = this.log

    if (options?.detectPages === false) {
      this.detectPages = false
    }

    if (options?.url) {
      try {
        const url = new URL(options.url).href // will throw if invalid
        this.url = url
      } catch (_err) {
        log.warn('"url" provided is invalid. Skipping.')
      }
    }

    if (options?.ts) {
      try {
        const ts = new Date(options.ts).toISOString // will throw if invalid
        this.ts = ts
      } catch (_err) {
        log.warn('"ts" provided is invalid. Skipping.')
      }
    }

    if (options?.title) {
      this.title = String(options.title).trim()
    }

    if (options?.description) {
      this.description = String(options.description).trim()
    }

    if (options?.signingUrl) {
      try {
        const signingUrl = new URL(options.signingUrl).href // will throw if invalid
        this.signingUrl = signingUrl
      } catch (_err) {
        log.warn('"signingUrl" provided is not a valid url. Skipping.')
      }
    }

    if (options?.signingToken && this.signingUrl) {
      this.signingToken = String(options.signingToken)
    }

    if (options?.datapackageExtras) {
      try {
        const datapackageExtras = JSON.stringify(options.datapackageExtras) // will throw if invalid
        this.datapackageExtras = datapackageExtras
      } catch (_err) {
        log.warn('"datapackageExtras" provided is not JSON-serializable object. Skipping.')
      }
    }
  }

  /**
   * Checks if `this.ready` is true, throws otherwise.
   * @throws
   * @returns {void}
   */
  readyStateCheck = () => {
    if (this.ready !== true) {
      throw new Error('Not enough information was provided for processing to start.')
    }
  }

  /**
   * Creates an Archiver instance which streams out to `this.output`.
   * @returns {void}
   */
  initOutputStreams = () => {
    this.readyStateCheck()

    this.outputStream = createWriteStream(this.output)
    this.archiveStream = new Archiver('zip', { store: true })
    this.archiveStream.pipe(this.outputStream)
  }

  /**
   * Initializes the worker pool for the "indexWARC" function.
   * @returns {void}
   */
  initWorkerPool = () => {
    this.readyStateCheck()

    this.indexWARCPool = new Piscina({
      filename: new URL('./workers/indexWARC.js', import.meta.url).href
    })
  }

  /**
   * Computes the SHA256 hash of a given file or chunk of data.
   *
   * @throws
   * @param {string|Uint8Array} file - Path to a file OR Buffer / Uint8Array.
   * @returns {Promise<string>} - "sha256:<digest>"
   */
  sha256 = async (file) => {
    // If buffer was given: directly process it.
    if (file instanceof Uint8Array) {
      return 'sha256:' + createHash('sha256').update(file).digest('hex')
    }

    // If filename was given: stream file into hash function.
    // Inspired by answers on: https://stackoverflow.com/q/18658612
    try {
      await fs.access(file)
    } catch (err) {
      this.log.trace(err)
      throw new Error(`${file} cannot be read.`)
    }

    const stream = createReadStream(file)
    const hash = createHash('sha256')
    let digest = ''

    hash.setEncoding('hex')

    await new Promise((resolve, reject) => {
      stream.on('error', err => reject(err))
      stream.on('data', chunk => hash.update(chunk))

      stream.on('end', () => {
        hash.end()
        digest = hash.read()
        resolve()
      })

      stream.pipe(hash)
    })

    return `sha256:${digest}`
  }
}
