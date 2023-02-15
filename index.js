//
// Quick test / sketching things out / ignore this mess:
// ---
// - List files from provided glob pattern
// - Process up to X .warc(.gz) files in parallel
//
import { fork } from 'child_process'
import { cpus } from 'os'
import { basename } from 'path'
import glob from 'glob'

/** @type {{url: string, title: string, ts: string}[]]} */
const pages = []

/** @type {string[]} */
const cdx = []

/** @type {string[]} */
const idx = []

/** @type {object.<filename, hash>} */
const hashes = {}

/** @type {string[]} */
// const warcs = glob.sync('tmp/adapt-warcs/*.warc')
const warcs = glob.sync('tmp/archive-it-warcs/*.warc.gz')

const concurrency = cpus().length ? cpus().length : 5
const group = []

/**
 *
 * @param {string} filename
 * @returns {Promise<boolean>}
 */
async function processWARC (filename) {
  const indexProcess = fork('./indexWARC.js')
  const pagesProcess = fork('./detectPagesInWARC.js')
  const hashProcess = fork('./computeSHA256.js')

  // In parallel ...
  const results = await Promise.allSettled([
    //
    // Generate CDXJ for the current WARC
    //
    new Promise((resolve, reject) => {
      indexProcess.send({ filename })

      indexProcess.on('message', (message) => {
        cdx.push(...message.cdx)
        return resolve()
      })

      indexProcess.on('error', err => reject(err))
    }),
    //
    // Try to identify potential pages for the current WARC
    //
    new Promise((resolve, reject) => {
      pagesProcess.send({ filename })

      pagesProcess.on('message', (message) => {
        pages.push(...message.pages)
        return resolve()
      })

      pagesProcess.on('error', err => reject(err))
    }),
    //
    // Compute the SHA256 hash of the current WARC
    //
    new Promise((resolve, reject) => {
      hashProcess.send({ filename })

      hashProcess.on('message', (message) => {
        hashes[basename(filename)] = message.hash
        return resolve()
      })

      hashProcess.on('error', err => reject(err))
    })
  ])

  let allOk = true

  for (const result of results) {
    if (result.status === 'rejected') {
      console.trace(result.reason)
      allOk = false
    }
  }

  return allOk
}

console.time('processing')
for (let i = 0; i < warcs.length; i++) {
  const filename = warcs[i]

  if (group.length < concurrency) {
    group.push(filename)
  }

  if (group.length >= concurrency || i === warcs.length - 1) {
    await Promise.allSettled(group.map(filename => processWARC(filename)))

    group.length = 0
  }
}

//
// Sort CDX and generate IDX array (every 1000th entry of CDX list)
//
cdx.sort()

for (let i = 0; i < cdx.length; i += 1000) {
  idx.push(cdx[i])
}

//
// Open new ZIP
//

//
// Prepare and add index.cdx.gz
//
// Compute hash to index.cdx.gz

//
// Prepare and add index.idx
//
// Compute hash to index.cdx.gz

//
// Add all WARCS
//

//
// Prepare and add pages.jsonl
//
// TODO: Accept external pages.jsonl

//
// Prepare datapackage.json
//

//
// Prepare datapackage-digest.json
//

// TODO: Prepare datapackage.json
// TODO: Prepare datapackage-digest.json
// TODO: Accept external pages.jsonl
console.timeEnd('processing')

process.exit(0)
