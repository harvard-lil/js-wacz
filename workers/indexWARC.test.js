/// <reference path="../types.js" />

import test from 'node:test'
import assert from 'node:assert/strict'
import { sep } from 'path'

import indexWARC from './indexWARC.js'
import { FIXTURES_PATH } from '../constants.js'

test('indexWARC throws if no filename was provided.', async (_t) => {
  assert.rejects(indexWARC())
})

test('indexWARC throws if invalid filename was provided.', async (_t) => {
  assert.rejects(indexWARC('foo'))
  assert.rejects(indexWARC('/foo.warc'))
  assert.rejects(indexWARC('/foo.warc.gz'))
})

test('indexWARC returns CDXJ and detected pages for a given WARC file.', async (_t) => {
  const results = await indexWARC({
    filename: `${FIXTURES_PATH}${sep}lil-projects.warc.gz`
  })

  assert(results.cdx.length > 0)

  for (const entry of results.cdx) { // Loosely check CDXJ format
    const split = entry.split(' ')
    assert(split.length === 3)

    const json = JSON.parse(split[2])
    assert(json.offset)
    assert(json.length)
    assert(json.url)
    assert(json.filename)
  }

  assert(results.pages.length > 0)

  for (const page of results.pages) { // Loosely check pages format
    assert(page.id)
    assert(page.url)
    assert(page.ts)
    assert(page.title)
  }
})

test('indexWARC does not detect pages if detectPages option is off.', async (_t) => {
  const results = await indexWARC({
    filename: `${FIXTURES_PATH}${sep}lil-projects.warc.gz`,
    detectPages: false
  })

  assert(results.cdx.length > 0)
  assert(results.pages.length === 0)
})
