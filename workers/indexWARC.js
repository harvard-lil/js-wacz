/// <reference path="../types.js" />

import { createReadStream } from 'fs'
import fs from 'fs/promises'
import { basename } from 'path'

import { parse as parseHTML } from 'node-html-parser'
import { CDXAndRecordIndexer } from 'warcio'
import { v4 as uuidv4 } from 'uuid'

/**
 * Iterates over a .warc or .warc.gz file and:
 * - Generates CDXJ entries
 * - Detect pages (optional)
 *
 * Worker function.
 *
 * @param {Object} options
 * @param {string} options.filename
 * @param {boolean} [options.detectPages=true]
 *
 * @returns {Promise<{cdx: string[], pages: WACZPage[]>}}
 */
export default async (options = {}) => {
  const filename = options?.filename
  const detectPages = options?.detectPages !== false

  /** @type {{cdx: string[], pages: WACZPage[]>} */
  const output = { cdx: [], pages: [] }

  if (!filename) {
    throw new Error('No filename provided.')
  }

  await fs.access(filename) // throws if file does not exist / is not accessible

  // For each record:
  // - Grab CDX and convert to CDXJ
  // - If page detection is active: parse HTML from record (if text/html response)
  const indexer = new CDXAndRecordIndexer()
  const stream = createReadStream(filename)

  for await (const { cdx, record } of indexer.iterIndex([{ reader: stream, filename: basename(filename) }])) {
    //
    // CDXJ processing
    //
    const cdxj = indexer.serializeCDXJ(cdx)

    if (cdxj) {
      output.cdx.push(cdxj)
    }

    //
    // Page detection
    //
    if (!detectPages) {
      continue
    }

    const warcType = record.warcHeader('WARC-Type')
    const statusCode = record?.httpHeaders?.statusCode
    const contentType = record?.httpHeaders?.headers?.get('content-type')
    const targetURI = record.warcHeader('WARC-Target-URI')
    const warcDate = record.warcHeader('WARC-Date')

    // Eligible candidates: text/html response with success status code, target URI and date
    if (
      warcType !== 'response' ||
      statusCode > 299 ||
      !contentType ||
      !contentType.startsWith('text/html') ||
      !targetURI ||
      !warcDate
    ) {
      continue
    }

    // Access content body and try to find page title, if any.
    try {
      const body = await record.contentText()
      const html = parseHTML(body)
      const title = html?.querySelector('title')?.textContent

      output.pages.push({
        id: uuidv4().replaceAll('-', ''),
        url: targetURI,
        title: title || targetURI,
        ts: warcDate
      })
    } catch (_err) { }
  }

  return output
}
