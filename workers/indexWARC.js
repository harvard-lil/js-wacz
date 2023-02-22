/// <reference path="../types.js" />

import { createReadStream } from 'fs'
import fs from 'fs/promises'
import { basename } from 'path'

import { parse as parseHTML } from 'node-html-parser'
import { WARCParser, CDXIndexer } from 'warcio'
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

  if (!filename) {
    throw new Error('No filename provided.')
  }

  await fs.access(filename)

  const cdx = []
  const pages = []
  const stream = createReadStream(filename)
  const parser = new WARCParser(stream)
  const indexer = new CDXIndexer()

  for await (const record of parser) {
    // Skip records that should not be indexed
    if (!indexer.filterRecord(record)) {
      continue
    }

    // Records need to be read fully so:
    // - `indexer.indexRecord()` knows their actual content-length
    // - The pages detection mechanism can access their content.
    await record.readFully()

    //
    // Create CDX entry for current record
    //
    const entry = indexer.indexRecord(record, parser, basename(filename))

    if (entry && entry?.mime !== 'application/warc-fields') {
      cdx.push(indexer.serializeCDXJ(entry))
    }

    //
    // Try to detect pages in record
    //
    if (detectPages) {
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
      const body = await record.contentText()
      const html = parseHTML(body)
      const title = html?.querySelector('title')?.textContent

      pages.push({
        id: uuidv4().replaceAll('-', ''),
        url: targetURI,
        title: title || targetURI,
        ts: warcDate
      })
    }
  }

  return { cdx, pages }
}
