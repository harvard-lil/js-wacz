//
// Quick test / sketching things out / ignore this mess:
// ---
// - List files from provided glob pattern
// - Group files in arrays of X entries for parallel processing
// - Process up to X .warc(.gz) files in parallel
// - Compute hashes in workers
//
import glob from 'glob'
import fs from 'fs'

import { parse as parseHTML } from 'node-html-parser'
import { CDXIndexer, WARCParser } from 'warcio'

/**
 * Iterates over a WARC file and generates CDXJ entries, which will be added to the main `cdx` array.
 * @param {string} filename - Path to .warc or .warc.gz file
 * @returns {Promise<boolean>}
 */
async function indexWARC (filename) {
  const stream = fs.createReadStream(filename)
  const indexer = new CDXIndexer()

  for await (const record of indexer.iterIndex([{ reader: stream, filename }])) {
    cdx.push(indexer.serializeCDXJ(record))
  }

  return true
}

/**
 * Iterates over a WARC file and detect potential HTML documents, which will be listed in the main `pages` array.
 * Will try to parse titles.
 * @param {string} filename - Path to .warc or .warc.gz file
 * @returns {Promise<boolean>}
 */
async function detectPagesInWARC (filename) {
  const stream = fs.createReadStream(filename)
  const parser = new WARCParser(stream)

  for await (const record of parser) {
    // Only consider HTTP responses
    if (record.warcHeader('WARC-Type') !== 'response') {
      continue
    }

    // Only consider text/html responses
    const contentType = record.httpHeaders.headers.get('content-type')
    if (!contentType || !contentType?.startsWith('text/html')) {
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

  return true
}

/**
 * Processes a WARC file:
 * - Creates CDXJ entries for it
 * - Tries to detect pages
 * @param {string} filename - Path to .warc or .warc.gz file
 * @returns {Promise<boolean>}
 */
async function processWARC (filename) {
  fs.accessSync(filename) // File should exist
  const results = await Promise.allSettled([indexWARC(filename), detectPagesInWARC(filename)])

  let allOk = true
  for (const result of results) {
    if (result.status === 'rejected') {
      allOk = false
      console.trace(result.reason)
    }
  }

  return allOk
}

/** @type {{url: string, title: string, ts: string}[]]} */
const pages = []

/** @type {string[]} */
const cdx = []

/** @type {string[]} */
const idx = []

/** @type {string[]} */
const warcs = glob.sync('tmp/warcs/*.warc')

const concurrency = 5
const group = []

console.time('processing')
for (let i = 0; i < warcs.length; i++) {
  const filename = warcs[i]

  if (group.length < concurrency) {
    group.push(filename)
  }

  if (group.length >= concurrency || i == warcs.length - 1) {
    console.log(group)
    const results = await Promise.allSettled(group.map(filename => processWARC(filename)))

    for (const result of results) {
      if (result.status === 'rejected') {
        console.trace(result.reason)
      }
    }

    group.length = 0

    // Sort CDX after each group has been processed
    cdx.sort()
  }
}
console.timeEnd('processing')
// TODO: When preparing datapackage, hashes should be computed in workers.
// TODO: Accept external pages.jsonl
