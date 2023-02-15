//
// Quick test / sketching things out / ignore this mess
//
import fs from 'fs'
import { createHash } from 'crypto'

import glob from 'glob'
import { Piscina } from 'piscina'

/** @type {{url: string, title: string, ts: string}[]]} */
const pages = []

/** @type {string[]} */
const cdx = []

/** @type {string[]} */
const idx = []

/** @type {string[]} */
// const warcs = glob.sync('tmp/adapt-warcs/*.warc')
const warcs = glob.sync('tmp/archive-it-warcs/*.warc.gz')

/**
 * @param {Buffer|string} filenameOrBuffer
 * @returns {string} 'sha256:'
 */
export function hash (filenameOrBuffer) {
  let file = filenameOrBuffer

  if (filenameOrBuffer instanceof Buffer) {
    file = fs.readFileSync(filenameOrBuffer)
  }

  return 'sha256:' + createHash('sha256').update(file).digest('hex')
}

//
// Index WARCs
//
console.time('index-warcs')
const indexWARCPool = new Piscina({
  filename: new URL('./workers/indexWARC.js', import.meta.url).href
})

await Promise.all(warcs.map(async filename => {
  const results = await indexWARCPool.run(filename)
  cdx.push(...results)
}))
console.timeEnd('index-warcs')

//
// Detect pages in WARCs
//
console.time('detect-pages')
const detectPagesPool = new Piscina({
  filename: new URL('./workers/detectPages.js', import.meta.url).href
})

await Promise.all(warcs.map(async filename => {
  const results = await detectPagesPool.run(filename)
  pages.push(...results)
}))
console.timeEnd('detect-pages')

//
// Sort CDX
//
console.time('sort-cdx')
cdx.sort()
console.timeEnd('sort-cdx')

// TODO: Many things :) but proof of concept is ok!
