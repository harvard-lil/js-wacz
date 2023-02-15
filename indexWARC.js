import fs from 'fs'
import { CDXIndexer } from 'warcio'

/**
 * Iterates over a WARC file and generates CDXJ entries, which will be added to the main `cdx` array.
 * @param {string} filename - Path to .warc or .warc.gz file
 * @returns {Promise<string[]>}
 */
export async function indexWARC (filename) {
  const cdx = []
  const stream = fs.createReadStream(filename)
  const indexer = new CDXIndexer()

  for await (const record of indexer.iterIndex([{ reader: stream, filename }])) {
    cdx.push(indexer.serializeCDXJ(record))
  }

  return cdx
}

process.on('message', async (message) => {
  if (!message.filename) {
    throw new Error('Expected "filename" in message.')
  }

  fs.accessSync(message.filename)

  process.send({ cdx: await indexWARC(message.filename) })
})
