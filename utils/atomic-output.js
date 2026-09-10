import { createWriteStream, mkdtempSync } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import Archiver from 'archiver'

/** A ZIP staged on the destination filesystem until every write succeeds. */
export class AtomicOutput {
  error = null
  disposal = null
  closing = false

  constructor (destination) {
    this.destination = resolve(destination)
    this.directory = mkdtempSync(join(dirname(this.destination), '.js-wacz-'))
    this.path = join(this.directory, 'archive.wacz')
    this.archive = new Archiver('zip', { store: true })
    this.stream = createWriteStream(this.path)

    // Observe errors immediately, including between incremental library calls.
    // Keep the failure promise fulfilled until a caller explicitly awaits run().
    this.failure = new Promise(resolve => {
      const fail = error => {
        // Aborting staged output is cleanup, not a new failure that should
        // replace the input/signing error already being propagated by a caller.
        if (this.closing) return
        this.error ??= error
        resolve(this.error)
      }
      this.archive.on('error', fail)
      this.stream.on('error', fail)
    })
    // Archiver otherwise permits missing inputs to produce an incomplete ZIP.
    this.archive.on('warning', error => this.archive.destroy(error))
    this.completion = pipeline(this.archive, this.stream).then(
      () => null,
      error => {
        this.error ??= error
        this.archive.abort()
        return error
      }
    )
  }

  check () {
    if (this.error) throw this.error
  }

  async run (operation) {
    return await Promise.race([
      operation,
      this.failure.then(error => { throw error })
    ])
  }

  async finalize () {
    this.check()
    await this.run(Promise.all([this.archive.finalize(), this.completion]))
    this.check()
    await rename(this.path, this.destination)
  }

  async dispose () {
    this.disposal ??= this.cleanup()
    await this.disposal
  }

  async cleanup () {
    this.closing = true
    this.archive.abort()
    this.archive.destroy()
    this.stream.destroy()
    await this.completion
    await rm(this.directory, { recursive: true, force: true })
  }
}
