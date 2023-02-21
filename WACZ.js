import fs from 'fs/promises'
import { createWriteStream, createReadStream, WriteStream } from 'fs'
import { createHash } from 'crypto'
import { basename } from 'path'

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
   * From WACZOptions.datapackageExtras.
   * @type {?Object}
   */
  datapackageExtras = {}

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
  archive = null

  /**
   * @param {WACZOptions} options
   */
  constructor (options = {}) {
    console.log('Hello world')
  }
}
