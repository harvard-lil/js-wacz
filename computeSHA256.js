import { createHash } from 'crypto'
import fs from 'fs'

export function computeSHA256 (filenameOrBuffer) {
  let file = filenameOrBuffer

  if (filenameOrBuffer instanceof Buffer) {
    file = fs.readFileSync(filenameOrBuffer)
  }

  return 'sha256:' + createHash('sha256').update(file).digest('hex')
}

process.on('message', async (message) => {
  if (!message.filename) {
    throw new Error('Expected "filename" in message.')
  }

  fs.accessSync(message.filename)

  process.send({ hash: computeSHA256(message.filename) })
})
