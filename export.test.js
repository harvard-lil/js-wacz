import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, sign, verify } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import StreamZip from 'node-stream-zip'
import { WACZ } from './index.js'
import { FIXTURES_PATH, PAGES_DIR_FIXTURES_PATH, LOG_DIR_FIXTURES_PATH } from './constants.js'
import { assertValidWACZSignature } from './utils/signatures.js'

const log = Object.fromEntries(['info', 'warn', 'error', 'trace'].map(name => [name, () => {}]))
const input = join(FIXTURES_PATH, 'lil-projects.warc.gz')
const sha256 = data => `sha256:${createHash('sha256').update(data).digest('hex')}`
const keys = generateKeyPairSync('ec', { namedCurve: 'secp384r1' })

const setup = async (t, options = {}) => {
  const directory = await mkdtemp(join(tmpdir(), 'js-wacz-test-'))
  const output = join(directory, 'output.wacz')
  const archive = new WACZ({ input, output, indexFromWARCs: false, log, ...options })
  t.after(async () => {
    await archive.dispose()
    await rm(directory, { recursive: true, force: true })
  })
  return { archive, directory, output }
}

const signedResponse = (request, dsaEncoding = 'der') => ({
  ...request,
  software: 'js-wacz local test signer',
  publicKey: keys.publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  signature: sign('sha256', Buffer.from(request.hash), { key: keys.privateKey, dsaEncoding }).toString('base64')
})

const signer = async (t, respond) => {
  const server = createServer(async (request, response) => {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const data = JSON.parse(Buffer.concat(chunks))
    response.setHeader('Content-Type', 'application/json')
    response.end(JSON.stringify(respond(data)))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })
  return `http://127.0.0.1:${server.address().port}/sign`
}

// Read the emitted ZIP with a different library and hash its actual entry bytes.
// This deliberately does not call the writer's hash or signature helpers.
const checkArchive = async output => {
  const zip = new StreamZip.async({ file: output }) // eslint-disable-line new-cap
  try {
    const manifestBytes = await zip.entryData('datapackage.json')
    const manifest = JSON.parse(manifestBytes)
    const digest = JSON.parse(await zip.entryData('datapackage-digest.json'))
    assert.equal(digest.path, 'datapackage.json')
    assert.equal(digest.hash, sha256(manifestBytes))
    for (const resource of manifest.resources) {
      const bytes = await zip.entryData(resource.path)
      assert.equal(resource.hash, sha256(bytes), resource.path)
      assert.equal(resource.bytes, bytes.length, resource.path)
    }
    return { manifest, digest }
  } finally {
    await zip.close()
  }
}

test('file and buffer hashes match independent SHA-256 at stream boundaries', async t => {
  const { archive, directory } = await setup(t)
  for (const size of [0, 1, 65535, 65536, 65537, 200000]) {
    await t.test(`${size} bytes`, async () => {
      const bytes = Buffer.from(Array.from({ length: size }, (_, i) => i % 251))
      const path = join(directory, 'resource')
      await writeFile(path, bytes)
      assert.equal(await archive.sha256(path), sha256(bytes))
      assert.equal(await archive.sha256(bytes), sha256(bytes))
    })
  }
  await assert.rejects(archive.sha256(join(directory, 'missing')), /cannot be read/)
})

test('every resource hash covers emitted bytes, including copied pages and logs', async t => {
  const { archive, output } = await setup(t, { pagesDir: PAGES_DIR_FIXTURES_PATH, logDir: LOG_DIR_FIXTURES_PATH })
  t.mock.method(archive, 'initWorkerPool', () => assert.fail('Indexing was disabled'))
  await archive.addFileToZip(Buffer.from('buffer resource'), 'extras/buffer.txt')
  await archive.process(false)
  await checkArchive(output)
  assert.equal(archive.indexWARCPool, null)
})

for (const encoding of ['der', 'ieee-p1363']) {
  test(`valid ${encoding} signing response covers the exact root manifest`, async t => {
    let requestedHash
    const signingUrl = await signer(t, request => {
      requestedHash = request.hash
      return signedResponse(request, encoding)
    })
    const { archive, output } = await setup(t, { signingUrl })
    await archive.addFileToZip(Buffer.from('a different manifest'), 'extras/datapackage.json')
    await archive.process(false)
    const { digest } = await checkArchive(output)
    assert.equal(requestedHash, digest.hash)
    assert.equal(digest.signedData.hash, digest.hash)
    assert(verify('sha256', Buffer.from(digest.hash), { key: keys.publicKey, dsaEncoding: encoding }, Buffer.from(digest.signedData.signature, 'base64')))
  })
}

test('existing RSA domain signature fixture verifies and rejects tampering', async () => {
  const signedData = JSON.parse(await readFile(join(FIXTURES_PATH, 'authsign-response.json')))
  assert.doesNotThrow(() => assertValidWACZSignature(signedData, signedData.hash))
  assert.throws(() => assertValidWACZSignature({ ...signedData, signature: 'AAAA' }, signedData.hash))
  const otherHash = sha256(Buffer.from('different'))
  assert.throws(() => assertValidWACZSignature({ ...signedData, hash: otherHash }, otherHash))
})

test('ECDSA domain signatures verify with the first certificate, without applying timestamp trust policy', async () => {
  const signedData = JSON.parse(await readFile(join(FIXTURES_PATH, 'ecdsa-signature.json')))
  assert.doesNotThrow(() => assertValidWACZSignature(signedData, signedData.hash))
  assert.throws(() => assertValidWACZSignature({ ...signedData, signature: 'AAAA' }, signedData.hash))
})

const invalidSignatures = {
  'valid signature for another hash': request => signedResponse({ ...request, hash: sha256(Buffer.from('another manifest')) }),
  'signature over different bytes': request => ({ ...signedResponse({ ...request, hash: sha256(Buffer.from('another manifest')) }), hash: request.hash }),
  'invalid signature': request => ({ ...signedResponse(request), signature: 'AAAA' }),
  'empty signature': request => ({ ...signedResponse(request), signature: '' }),
  'malformed key': request => ({ ...signedResponse(request), publicKey: 'AAAA' }),
  'missing response fields': () => ({}),
  'null response': () => null
}

for (const [name, respond] of Object.entries(invalidSignatures)) {
  test(`signer rejection preserves an existing archive: ${name}`, async t => {
    const signingUrl = await signer(t, respond)
    const { archive, output, directory } = await setup(t, { signingUrl })
    await writeFile(output, 'previous archive')
    await assert.rejects(archive.process(false), /generating "datapackage-digest.json"/)
    assert.equal(await readFile(output, 'utf8'), 'previous archive')
    assert.deepEqual(await readdir(directory), ['output.wacz'])
    assert.equal(archive.consumed, true)
    assert.equal(archive.indexWARCPool, null)
  })
}

test('construction and incremental additions preserve output until successful finalization', async t => {
  const { archive, output, directory } = await setup(t)
  await writeFile(output, 'previous archive')
  const unused = new WACZ({ input, output, log })
  await unused.dispose()
  assert.throws(() => new WACZ({ input, output, signingUrl: 'invalid', log }))
  assert.equal(await readFile(output, 'utf8'), 'previous archive')
  await archive.addFileToZip(Buffer.from('incremental'), 'extras/data')
  assert.equal(await readFile(output, 'utf8'), 'previous archive')
  await archive.writeWARCsToZip()
  await archive.writeDatapackageToZip()
  await archive.writeDatapackageDigestToZip()
  await archive.finalize()
  await checkArchive(output)
  assert.deepEqual(await readdir(directory), ['output.wacz'])
  await assert.rejects(archive.finalize(), /consumed/)
})

test('incremental callers can dispose unfinished output and workers repeatedly', async t => {
  const { archive, output, directory } = await setup(t)
  await writeFile(output, 'previous archive')
  await archive.addFileToZip(Buffer.from('unfinished'), 'extras/data')
  archive.initWorkerPool()
  const pool = archive.indexWARCPool
  await archive.dispose()
  await archive.dispose()
  assert.equal(pool.threads.length, 0)
  assert.equal(await readFile(output, 'utf8'), 'previous archive')
  assert.deepEqual(await readdir(directory), ['output.wacz'])
})

test('a missing output parent rejects through process()', async t => {
  const { archive, directory } = await setup(t)
  archive.output = join(directory, 'missing', 'output.wacz')
  await assert.rejects(archive.process(false), /ENOENT/)
  assert.deepEqual(await readdir(directory), [])
})

test('a destination rename failure rejects and cleans the staging directory', async t => {
  const { archive, output, directory } = await setup(t)
  await mkdir(output)
  await writeFile(join(output, 'keep'), 'existing directory')
  await assert.rejects(archive.process(false), error => ['EISDIR', 'EEXIST', 'EPERM'].includes(error.code))
  assert.deepEqual(await readdir(directory), ['output.wacz'])
  assert.equal(await readFile(join(output, 'keep'), 'utf8'), 'existing directory')
})

for (const stream of ['outputStream', 'archiveStream']) {
  test(`${stream} errors reject and clean up without replacing output`, async t => {
    const { archive, output, directory } = await setup(t)
    await writeFile(output, 'previous archive')
    await archive.addFileToZip(Buffer.from('data'), 'extras/data')
    const failure = new Error('injected stream failure')
    archive[stream].destroy(failure)
    await new Promise(resolve => setImmediate(resolve))
    await assert.rejects(archive.finalize(), failure)
    assert.equal(await readFile(output, 'utf8'), 'previous archive')
    assert.deepEqual(await readdir(directory), ['output.wacz'])
  })
}

test('Archiver missing-file warnings reject instead of finalizing an incomplete ZIP', async t => {
  const { archive, directory } = await setup(t)
  archive.initOutputStreams()
  archive.archiveStream.file(join(directory, 'missing'), { name: 'missing' })
  await assert.rejects(archive.finalize(), { code: 'ENOENT' })
  assert.deepEqual(await readdir(directory), [])
})

test('a rejected Archiver finalization promise is propagated', async t => {
  const { archive, directory } = await setup(t)
  archive.initOutputStreams()
  t.mock.method(archive.archiveStream, 'finalize', async () => { throw new Error('finalization failed') })
  await assert.rejects(archive.finalize(), /finalization failed/)
  assert.deepEqual(await readdir(directory), [])
})

test('an incremental missing input rejects and discards staged output', async t => {
  const { archive, directory } = await setup(t)
  await assert.rejects(archive.addFileToZip(join(directory, 'missing'), 'extras/data'), { code: 'ENOENT' })
  assert.deepEqual(await readdir(directory), [])
})

test('cleanup preserves the processing error that caused output to be discarded', async t => {
  const { archive, directory } = await setup(t)
  const failure = new Error('processing failed before finalization')
  t.mock.method(archive, 'writeWARCsToZip', async () => { throw failure })
  await assert.rejects(archive.process(false), failure)
  assert.deepEqual(await readdir(directory), [])
})

test('a missing WARC preserves the file error as the cause, rather than a cleanup stream error', async t => {
  const { archive, directory } = await setup(t)
  archive.WARCs = [join(directory, 'missing.warc')]
  await assert.rejects(archive.process(false), error => error.cause?.code === 'ENOENT')
  assert.deepEqual(await readdir(directory), [])
})

test('an output failure aborts an in-flight signing request and cleans up', { timeout: 5000 }, async t => {
  let arrived
  let closed
  const requestArrived = new Promise(resolve => { arrived = resolve })
  const responseClosed = new Promise(resolve => { closed = resolve })
  const server = createServer((request, response) => {
    request.resume()
    request.on('end', arrived)
    response.on('close', closed)
    // Leave the response open until the writer cancels it after the I/O error.
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })
  const { archive, directory } = await setup(t, { signingUrl: `http://127.0.0.1:${server.address().port}/sign` })
  const failure = new Error('output failed during signing')
  const rejected = assert.rejects(archive.process(false), failure)
  await requestArrived
  archive.outputStream.destroy(failure)
  await rejected
  await responseClosed
  assert.deepEqual(await readdir(directory), [])
})

test('repeated conversions close indexing workers and produce independently valid archives', async t => {
  for (let i = 0; i < 3; i++) {
    const { archive, output } = await setup(t, { indexFromWARCs: true })
    archive.initWorkerPool()
    const pool = archive.indexWARCPool
    archive.initWorkerPool()
    assert.equal(archive.indexWARCPool, pool)
    await archive.process(false)
    assert.equal(pool.threads.length, 0)
    assert.equal(archive.indexWARCPool, null)
    await checkArchive(output)
  }
})

test('an indexing failure closes workers and preserves the destination', async t => {
  const { archive, directory, output } = await setup(t, { indexFromWARCs: true })
  const temporaryInput = join(directory, 'removed.warc.gz')
  await copyFile(input, temporaryInput)
  archive.WARCs = [temporaryInput]
  archive.initWorkerPool()
  const pool = archive.indexWARCPool
  await writeFile(output, 'previous archive')
  await rm(temporaryInput)
  await assert.rejects(archive.process(false), /ENOENT/)
  assert.equal(pool.threads.length, 0)
  assert.equal(await readFile(output, 'utf8'), 'previous archive')
  assert.deepEqual(await readdir(directory), ['output.wacz'])
})

test('the CLI reports invalid signing configuration without removing an existing output', async t => {
  const { output } = await setup(t)
  await writeFile(output, 'previous archive')
  await assert.rejects(promisify(execFile)(process.execPath, ['bin/cli.js', 'create', '-f', input, '-o', output, '--signing-url', 'invalid']), { code: 1 })
  assert.equal(await readFile(output, 'utf8'), 'previous archive')
})
