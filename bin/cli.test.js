import test from 'node:test'
import assert from 'node:assert/strict'
import { sep } from 'path'
import fs from 'fs/promises'

import StreamZip from 'node-stream-zip'

import { execSync } from 'node:child_process'

import { FIXTURES_PATH } from '../constants.js'

// TODO: Actual tests CLI test suite.
// For this very first version of this package, a decision was made to focus on tests of the underlying library.
test('Invoke "create" command and check that a WACZ was created.', async (_t) => {
  const output = 'tmp.wacz'

  let command = 'node bin/cli create '
  command += `--file "${FIXTURES_PATH}${sep}*.warc.gz" `
  command += `--output ${output} `

  execSync(command)

  // Check that a valid ZIP file was created as a result of the operation
  assert.doesNotThrow(() => new StreamZip.async({ file: output })) // eslint-disable-line

  await fs.unlink(output)
})
