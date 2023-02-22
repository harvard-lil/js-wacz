/**
 * CLI entry point for js-wacz
 */
import { createReadStream } from 'fs'
import * as readline from 'node:readline/promises'

import log from 'loglevel'
import logPrefix from 'loglevel-plugin-prefix'
import { Command } from 'commander'

import { WACZ } from './index.js'
import { PACKAGE_INFO, LOGGING_COLORS } from './constants'

const program = new Command()

/**
 * Program info
 * @type {Command}
 */
program
  .name(PACKAGE_INFO.name)
  .description(PACKAGE_INFO.description)
  .version(PACKAGE_INFO.version)

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
    'Path to a jsonl files to be used to replace pages.jsonl. ' +
    'If not provided, js-wacz will attempt to detect pages.')
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

    // `--files` is mandatory
    if (!values?.file) {
      console.error('Error: --file not provided.')
      return
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
        log
      })
    } catch (err) {
      log.error(`${err}`) // Show simplified version
      return
    }

    // Ingest user-provided pages.jsonl file, if any.
    if (values?.pages) {
      try {
        log.info(`pages.jsonl: Reading entries from ${values?.pages}`)
        const rl = readline.createInterface({ input: createReadStream(values.pages) })

        for await (const line of rl) {
          const page = JSON.parse(line)

          if (!page?.url) {
            continue
          }

          log.info(`Adding ${page.url}`)
          archive.addPage(page?.url, page?.title, page?.ts)
        }
      } catch (err) {
        log.trace(err)
        log.error('An error occurred while processing user-provided pages.jsonl.')
      }
    }

    // Main process
    try {
      await archive.process()
      log.info(`WACZ file ready: ${values.output}`)
    } catch (err) {
      log.error(err)
      log.error('WACZ could not be processed.')
    }
  })

program.parse()
