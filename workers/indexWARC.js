import fs from 'fs'
import { CDXIndexer } from 'warcio'

/**
 * Iterates over a WARC file and generates CDXJ entries, which will be added to the main `cdx` array.
 * @param {string} filename - Path to .warc or .warc.gz file
 * @returns {Promise<string[]>}
 */
export default async (filename) => {
  fs.accessSync(filename)
  const cdx = []
  const stream = fs.createReadStream(filename)
  const indexer = new CDXIndexer()

  for await (const record of indexer.iterIndex([{ reader: stream, filename }])) {
    cdx.push(indexer.serializeCDXJ(record))
  }

  return cdx
}
