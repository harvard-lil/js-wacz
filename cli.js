/**
 * CLI entry point for js-wacz
 */
import fs from 'fs/promises'
import { Command } from 'commander'

import { WACZ } from './index.js'

const program = new Command()
const packageInfo = JSON.parse(await fs.readFile('package.json'))

program
  .name(packageInfo.name)
  .description(packageInfo.description)
  .version(packageInfo.version)

program.command('create')
  .description('Creates a .wacz file out of one or multiple .warc or .warc.gz files.')
  .argument('-f --file <string>', 'Path to .warc / .warc.gz file(s) to process. Wildcard characters may be used.')
  .option('-o --output <string>', 'Path to output .wacz file.', 'archive.wacz')
  .option('-p --pages <string>', 'Path to a jsonl files to be used in lieu of pages.jsonl. If not provided, js-wacz will attempt to detect pages.')
  .option('--url <string>', 'If provided, will be used as the "main page url" in datapackage.json.')
  .option('--ts <string>', 'If provided, will be used as the "main page date" in datapackage.json.')
  .option('--title <string>', 'If provided, will be used as the collection title.')
  .option('--desc <string>', 'If provided, will be used as the collection description.')
  .option('--signing-url <string>', 'If provided, will be used to cryptographically sign the archive. See https://specs.webrecorder.net/wacz-auth/0.1.0/')
  .option('--signing-token <string>', 'Required if the server at --signing-url requires an authentication token.')
  .action((str, options) => {
    console.log('Hello world')
  })

program.parse()
