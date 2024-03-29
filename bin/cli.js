#! /usr/bin/env node

import { createReadStream } from 'fs'
import fs from 'fs/promises'
import { resolve } from 'path'
import * as readline from 'node:readline/promises'

import log from 'loglevel'
import logPrefix from 'loglevel-plugin-prefix'
import { Command } from 'commander'

import { WACZ } from '../index.js'
import { PACKAGE_INFO, LOGGING_COLORS } from '../constants.js'

const program = new Command()

/**
 * Program info
 * @type {Command}
 */
program
  .name(PACKAGE_INFO.name)
  .description(PACKAGE_INFO.description)
  .version(PACKAGE_INFO.version, '-v, --version')

/**
 * `create` command
 * @type {Command}
 */
program.command('create')
  .description('Creates a .wacz file out of one or multiple .warc or .warc.gz files.')
  .option(
    '-f --file <string>',
    'Path to .warc / .warc.gz file(s) to process. Wrap in quotation marks if glob.')
  .option(
    '-o --output <string>',
    'Path to output .wacz file.', 'archive.wacz')
  .option(
    '-p --pages <string>',
    'Path to a directory of pages JSONL files to copy into WACZ as-is. ' +
    'If --pages is not provided, js-wacz will attempt to detect pages.')
  .option(
    '--url <string>',
    'If provided, will be used as the "main page url" in datapackage.json.')
  .option(
    '--ts <string>',
    'If provided, will be used as the "main page date" in datapackage.json.')
  .option(
    '--title <string>',
    'If provided, will be used as the collection title.')
  .option(
    '--desc <string>',
    'If provided, will be used as the collection description.')
  .option(
    '--signing-url <string>',
    'URL of an authsign-compatible server to be used to cryptographically sign the archive. ' +
    'See https://github.com/webrecorder/authsign.')
  .option(
    '--signing-token <string>',
    'Required if the server at --signing-url requires an authentication token.')
  .option(
    '--log-level <string>',
    'Can be "silent", "trace", "debug", "info", "warn", "error"', 'info')
  .option('--cdxj <string>',
    'Path to a directory containing CDXJ indices to merge into final WACZ CDXJ. ' +
    'If not provided, js-wacz will reindex from WARCS. Must be used in combination ' +
    'with --pages, since using this option will skip reading the WARC files.')
  .action(async (name, options, command) => {
    /** @type {Object} */
    const values = options._optionValues

    /** @type {?WACZ} */
    let archive = null

    // Set log output level and formatting
    logPrefix.reg(log)
    logPrefix.apply(log, {
      format (level, _name, timestamp) {
        const timestampColor = LOGGING_COLORS.DEFAULT
        const msgColor = LOGGING_COLORS[level.toUpperCase()]
        return `${timestampColor(`[${timestamp}]`)} ${msgColor(level)}`
      }
    })

    if (values?.logLevel) {
      let level = 'info'

      if (['silent', 'trace', 'debug', 'info', 'warn', 'error'].includes(values.logLevel)) {
        level = values.logLevel
      }

      log.setLevel(level)
      log.info(`Log output level as been set to ${level}.`)
    }

    // `--file` is mandatory
    if (!values?.file) {
      console.error('Error: --file not provided.')
      process.exit(1)
    }

    if (values?.cdxj && !values?.pages) {
      console.error('Error: --cdxj option must be used in combination with --pages.')
      process.exit(1)
    }

    // Pass options to WACZ
    try {
      archive = new WACZ({
        input: values.file,
        output: values?.output,
        url: values?.url,
        ts: values?.ts,
        title: values?.title,
        description: values?.desc,
        signingUrl: values?.signingUrl,
        signingToken: values?.signingToken,
        pages: values?.pages,
        log
      })
    } catch (err) {
      log.error(`${err}`) // Show simplified report
      process.exit(1)
    }

    // Ingest user-provided CDX files, if any.
    if (values?.cdxj) {
      try {
        const dirPath = values?.cdxj
        const cdxjFiles = await fs.readdir(dirPath)
        const allowedExts = ['cdx', 'cdxj']

        for (let i = 0; i < cdxjFiles.length; i++) {
          const cdxjFile = resolve(dirPath, cdxjFiles[i])

          const ext = cdxjFile.split('.').pop()
          if (!allowedExts.includes(ext)) {
            log.warn(`CDXJ: Skipping file ${cdxjFile}, not a CDXJ file`)
            continue
          }

          log.info(`CDXJ: Reading entries from ${cdxjFile}`)
          const rl = readline.createInterface({ input: createReadStream(cdxjFile) })

          for await (const line of rl) {
            archive.addCDXJ(line + '\n')
          }
        }
      } catch (err) {
        log.trace(err)
        log.warn('An error occurred while processing user-provided CDXJ indices.')
      }
    }

    // Main process
    try {
      await archive.process()
      log.info(`WACZ file ready: ${values.output}`)
    } catch (err) {
      log.trace(err)
      log.error('WACZ could not be processed.')
      process.exit(1)
    }
  })

program.parse()
