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
 * [!] Feb 28 2023:
 * This is a temporary and much less efficient implementation of this worker.
 * In order to circumvent a _potential_ bug in WARCParser.iterRecords(),
 * WARCs are iterated over twice at the moment.
 * TBD.
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
  const cdx = []
  const pages = []

  if (!filename) {
    throw new Error('No filename provided.')
  }

  await fs.access(filename) // throws if file does not exist / is not accessible

  // Try to build CDX for current warc
  cdx.push(...await getCDX(filename))

  // Try to detect pages in record
  if (detectPages) {
    pages.push(...await getPages(filename))
  }

  return { cdx, pages }
}

/**
 * Iterates over a WARC file and generates CDXJ entries, which will be added to the main `cdx` array.
 * @param {string} filename - Path to .warc or .warc.gz file
 * @returns {Promise<string[]>} - CDXJ entries
 */
const getCDX = async (filename) => {
  const cdx = []
  const stream = createReadStream(filename)
  const indexer = new CDXIndexer()

  for await (const record of indexer.iterIndex([{ reader: stream, filename: basename(filename) }])) {
    if (record.mime === 'application/warc-fields') {
      continue
    }

    cdx.push(indexer.serializeCDXJ(record))
  }

  return cdx
}

/**
 * Iterates over a WARC file and tries to detect HTML pages, so they can be later added to pages.jsonl.
 * @param {string} filename - Path to .warc or .warc.gz file
 * @returns {Promise<WACZPage[]>}
 */
const getPages = async (filename) => {
  const pages = []
  const stream = createReadStream(filename)
  const parser = new WARCParser(stream)

  for await (const record of parser) {
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

      pages.push({
        id: uuidv4().replaceAll('-', ''),
        url: targetURI,
        title: title || targetURI,
        ts: warcDate
      })
    } catch (_err) { }
  }

  return pages
}
