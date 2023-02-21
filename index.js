//
// Quick test / sketching things out / ignore this mess
//
// TODO: Many things :) but basic proof of concept is ok.
// - index-warcs and detect-pages steps can probably be merged
// - Extra: provide collection title and description?
// - Extra: signature
// - Extra: accept external pages.jsonl if provided (and per-page API)
// - Extra: support for adding extra data in datapackage.json
// - Think through proper architecture beyond this quick test

import fs from 'fs/promises'
import { createWriteStream, createReadStream } from 'fs'
import { createHash } from 'crypto'
import { basename } from 'path'
import { Deflate } from 'pako'

import glob from 'glob'
import BTree from 'sorted-btree'
import { Piscina } from 'piscina'
import Archiver from 'archiver'
import { v4 as uuidv4 } from 'uuid'

console.time('total')

/**
 * When building a ZipNum Shared index (index.idx as a lookup table for index.cdx.gz):
 * How many index lines should be grouped together?
 *
 * See: https://pywb.readthedocs.io/en/latest/manual/indexing.html#zipnum-sharded-index
 * @constant
 */
const ZIP_NUM_SHARED_INDEX_LIMIT = 3000

/** @type {{url: string, title: string, ts: string}[]]} */
const pages = []

/** @type {BTree} */
const cdxTree = new BTree.default() // eslint-disable-line

/** @type {string[]} */
let cdxArray = []

/** @type {string[]} */
const idxArray = []

/** @type {{name: string, path: string, hash: string, bytes: string}[]} */
const packageInfo = []

/** @type {string[]} */
// const warcs = glob.sync('tmp/adapt-warcs/*.warc')
const warcs = glob.sync('tmp/archive-it-warcs/*.warc.gz')

// Clear existing test file
try {
  await fs.unlink(`${process.env.PWD}/tmp/zip/example.wacz`)
} catch (_err) { }

/** @type {fs.WriteStream} */
const outputStream = createWriteStream(`${process.env.PWD}/tmp/zip/example.wacz`)

/** @type {Archiver} */
const archive = new Archiver('zip', { store: true })

// Connect archive to output stream
archive.pipe(outputStream)

/**
 * Inspired by: https://stackoverflow.com/a/18658613
 * @param {Buffer|string} filenameOrBuffer
 * @returns {string} 'sha256:<hash>'
 */
export async function hash (filenameOrBuffer) {
  const file = filenameOrBuffer

  // If buffer was given: directly process it.
  if (filenameOrBuffer instanceof Buffer) {
    return 'sha256:' + createHash('sha256').update(file).digest('hex')
  }

  // If filename was given: stream file into hash function.
  let digest = ''
  const stream = createReadStream(file)
  const hash = createHash('sha256')
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

//
// Index WARCs
//
console.time('index-warcs')
const indexWARCPool = new Piscina({
  filename: new URL('./workers/indexWARC.js', import.meta.url).href
})

await Promise.all(warcs.map(async filename => {
  const results = await indexWARCPool.run(filename)

  for (const value of results) {
    cdxTree.setIfNotPresent(value, true)
  }
}))
console.timeEnd('index-warcs')

//
// Detect pages in WARCs
// (Only if --detect-pages)? Or if no pages.jsonl provided.
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
// Extract sorted CDX
//
console.time('extract-sorted-cdx')
cdxArray = cdxTree.keysArray()
cdxTree.clear()
console.timeEnd('extract-sorted-cdx')

//
// Create indexes/index.cdx.gz and add it to the archive
//
console.time('write-index-cdx-gz')
try {
  /** @type {string|Buffer} */
  let cdx = Buffer.alloc(0)

  let idxOffset = 0

  for (let i = 0; i < cdxArray.length; i += ZIP_NUM_SHARED_INDEX_LIMIT) {
    let nextBound = i + ZIP_NUM_SHARED_INDEX_LIMIT

    if (nextBound > cdxArray.length) {
      nextBound = cdxArray.length - 1
    }

    // TODO: CDX lines probably need tweaking ...
    const cdxSlice = cdxArray.slice(i, nextBound).join('')

    let cdxSliceDeflated = new Deflate({ gzip: true })
    cdxSliceDeflated.push(cdxSlice, true)
    cdxSliceDeflated = cdxSliceDeflated.result

    const idxLineForSlice = cdxArray[i]
    const idxLineMeta = {
      offset: idxOffset,
      length: cdxSliceDeflated.byteLength,
      digest: await hash(Buffer.from(cdxSliceDeflated)),
      filename: 'index.cdx.gz'
    }

    idxOffset += cdxSliceDeflated.byteLength

    const newIdx = `${idxLineForSlice.split(' ').slice(0, 1).join(' ')} ${JSON.stringify(idxLineMeta)}\n`
    idxArray.push(newIdx)

    cdx = Buffer.concat([cdx, cdxSliceDeflated])
  }

  archive.append(cdx, { name: 'indexes/index.cdx.gz' })

  packageInfo.push({
    name: 'index.cdx.gz',
    path: 'indexes/index.cdx.gz',
    hash: await hash(cdx),
    bytes: cdx.byteLength
  })
} catch (err) {
  throw new Error(`An error occurred while generating indexes/index.cdx.gz.\n${err}`)
}
console.timeEnd('write-index-cdx-gz')

//
// Create indexes/index.idx and add it to the archive
//
console.time('write-index-idx')
try {
  /** @type {string|Buffer} */
  let idx = '!meta 0 {"format": "cdxj-gzip-1.0", "filename": "index.cdx.gz"}\n'

  for (const entry of idxArray) {
    idx += `${entry}`
  }

  archive.append(idx, { name: 'indexes/index.idx' })

  idx = Buffer.from(idx)

  packageInfo.push({
    name: 'index.idx',
    path: 'indexes/index.idx',
    hash: await hash(idx),
    bytes: idx.byteLength
  })
} catch (err) {
  throw new Error(`An error occurred while generating indexes/index.idx.\n${err}`)
}
console.timeEnd('write-index-idx')

//
// Create pages/pages.jsonl and add it to the archive
//
console.time('write-pages-jsonl')
try {
  /** @type {string|Buffer} */
  let pagesJSONL = '{"format": "json-pages-1.0", "id": "pages", "title": "All Pages"}\n'

  for (const page of pages) {
    pagesJSONL += `${JSON.stringify({ id: uuidv4().replaceAll('-', ''), ...page })}\n`
  }

  archive.append(pagesJSONL, { name: 'pages/pages.jsonl' })

  pagesJSONL = Buffer.from(pagesJSONL)

  packageInfo.push({
    name: 'pages.jsonl',
    path: 'pages/pages.jsonl',
    hash: await hash(pagesJSONL),
    bytes: pagesJSONL.byteLength
  })
} catch (err) {
  throw new Error(`An error occured while generating pages/pages.jsonl.\n${err}`)
}
console.timeEnd('write-pages-jsonl')

//
// Add WARCs to archive
//
console.time('storing-warcs')
for (const warc of warcs) {
  const filename = basename(warc)
  const stream = createReadStream(warc)
  archive.append(stream, { name: `archive/${basename(filename)}` })

  packageInfo.push({
    name: basename(filename),
    path: `archive/${filename}`,
    hash: await hash(warc),
    bytes: (await fs.stat(warc)).size
  })
}
console.timeEnd('storing-warcs')

//
// Create datapackage.json and add it to the archive
//
console.time('write-datapackage-json')
try {
  /** @type {string|Buffer} */
  let datapackage = JSON.stringify({
    title: 'js-wacz',
    created: new Date().toISOString(),
    wacz_version: '1.1.1',
    software: 'js-wacz 0.0.1',
    resources: packageInfo
  }, null, 2)

  archive.append(datapackage, { name: 'datapackage.json' })

  datapackage = Buffer.from(datapackage)

  packageInfo.push({
    name: 'datapackage.json',
    path: 'datapackage.json',
    hash: await hash(datapackage),
    bytes: datapackage.byteLength
  })
} catch (err) {
  throw new Error(`An error occurred while generating datapackage.json.\n${err}`)
}
console.timeEnd('write-datapackage-json')

//
// Create datapackage-digest.json and add it to the archive
//
console.time('write-datapackage-digest-json')
try {
  /** @type {string|Buffer} */
  const datapackageDigest = JSON.stringify({
    path: 'datapackage.json',
    hash: (packageInfo.find(entry => entry.name === 'datapackage.json')).hash
  }, null, 2)

  archive.append(datapackageDigest, { name: 'datapackage-digest.json' })
} catch (err) {
  throw new Error(`An error occurred while generating datapackage-digest.json.\n${err}`)
}
console.timeEnd('write-datapackage-digest-json')

//
// Finalizing archive
//
archive.finalize()

console.timeEnd('total')
