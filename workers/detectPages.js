import fs from 'fs'
import { parse as parseHTML } from 'node-html-parser'
import { WARCParser } from 'warcio'

/**
 * Iterates over a WARC file and detect potential HTML documents, which will be listed in the main `pages` array.
 * Will try to parse titles.
 * @param {string} filename - Path to .warc or .warc.gz file
 * @returns {Promise<{url: string, title: string, ts: string}[]>}
 */
export default async (filename) => {
  fs.accessSync(filename)
  const stream = fs.createReadStream(filename)
  const parser = new WARCParser(stream)
  const pages = []

  for await (const record of parser) {
    // Only consider HTTP responses
    if (record.warcHeader('WARC-Type') !== 'response') {
      continue
    }

    if (!record.httpHeaders) {
      continue
    }

    // Only consider text/html responses
    const contentType = record.httpHeaders.headers.get('content-type')
    if (!contentType || !contentType?.startsWith('text/html')) {
      continue
    }

    // Only consider HTTP 20X responses
    if (record.httpHeaders.statusCode > 299) {
      continue
    }

    // Only consider responses for which we have a target URI
    const targetURI = record.warcHeader('WARC-Target-URI')
    if (!targetURI) {
      continue
    }

    // Only consider responses for which we have a WARC date record
    const warcDate = record.warcHeader('WARC-Date')
    if (!warcDate) {
      continue
    }

    // Access content body and try to find page title, if any.
    const body = await record.contentText()
    const html = parseHTML(body)
    const title = html?.querySelector('title')?.textContent

    pages.push({
      url: targetURI,
      title: title || targetURI,
      ts: warcDate
    })
  }

  return pages
}
