# js-wacz 

[![Tests](https://github.com/harvard-lil/js-wacz/actions/workflows/test.yml/badge.svg)](https://github.com/harvard-lil/js-wacz/actions/workflows/test.yml) [![npm version](https://img.shields.io/npm/v/@harvard-lil/js-wacz)](https://www.npmjs.com/package/@harvard-lil/js-wacz) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

JavaScript module and CLI tool for working with web archive data using [the WACZ format specification](https://specs.webrecorder.net/wacz/1.1.1/), similar to [Webrecorder's py-wacz](https://github.com/webrecorder/py-wacz).

It can be used to combine a set of `.warc` / `.warc.gz` files into a single `.wacz` file:

**... programmatically (Node.js):**
```javascript
import { WACZ } from '@harvard-lil/js-wacz'

const archive = new WACZ({ 
  input: 'collection/*.warc.gz', 
  output: 'collection.wacz',
})

await archive.process() // "my-collection.wacz" is ready!
```

**... or via the command line:**
```bash
js-wacz -f "collection/*.warc.gz" -o "collection.wacz"
```

**js-wacz** makes use of workers to process as many WARC files in parallel as the host machine can handle.

---

## Summary
- [Install](#install)
- [CLI: `create` command](#cli-create-command)
- [Programmatic use](#programmatic-use)
- [Feature parity with py-wacz](#feature-parity-with-py-wacz)
- [Development](#development)

---

## Install

**js-wacz** requires [Node JS 18+](https://nodejs.org/en/). 

`npm` can be used to install this package and make the **js-wacz** command accessible system-wide:

```bash
npm install -g @harvard-lil/js-wacz
```

[👆 Back to summary](#summary)

---

## CLI: `create` command

The `create` command helps combine one or multiple `.warc` or `.warc.gz` files into a single `.wacz` file.

```bash
js-wacz -f "collection/*.warc.gz" -o "collection.wacz"
```

**js-wacz** accepts the following options and arguments for customizing how the WACZ file is assembled.

### --file, -f

This is the only **required** argument, which indicates what file(s) should be processed and added to the resulting WACZ file.

The target can be a single file, or a glob pattern such as `folder/*.warc.gz`. 

```bash
# Single file:
js-wacz --file archive.warc
```

```bash
# Collection:
js-wacz --file "collection/*.warc"
```

**Note:** When using globs, make sure to surround the path with quotation marks.

### --output, -o

Allows to specify where the resulting `.wacz` file should be created, and what its filename should be.

Defaults to `archive.wacz` in the current directory if not provided.

```bash
js-wacz --file cool-beans.warc --output cool-beans.wacz
```

### --pages, -p

Allows to pass a specific [pages.jsonl](https://specs.webrecorder.net/wacz/1.1.1/#pages-jsonl) file. 

If not provided, **js-wacz** is going to attempt to detect pages in WARC records to build its own `pages.jsonl` index.

```bash
js-wacz -f "collection/*.warc.gz" --pages collection/pages.jsonl
```

### --url

If provided, will be used as the [`mainPageUrl` attribute for `datapackage.json`](https://specs.webrecorder.net/wacz/1.1.1/#datapackage-json).

Must be a valid URL.

```bash
js-wacz -f "collection/*.warc.gz" --url "https://lil.law.harvard.edu"
```

### --ts

If provided, will be used as the [`mainPageDate` attribute for `datapackage.json`](https://specs.webrecorder.net/wacz/1.1.1/#datapackage-json).

Can be any value [that can be parsed by JavaScript's `Date() constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date).

```bash
js-wacz -f "collection/*.warc.gz" --ts "2023-02-22T12:00:00.000Z"
```

### --title

If provided, will be used as the [`title` attribute for `datapackage.json`](https://specs.webrecorder.net/wacz/1.1.1/#datapackage-json).

```bash
js-wacz -f "collection/*.warc.gz" --title "My collection."
```

### --desc

If provided, will be used as the [`description` attribute for `datapackage.json`](https://specs.webrecorder.net/wacz/1.1.1/#datapackage-json).

```bash
js-wacz -f "collection/*.warc.gz" --desc "My cool collection of web archives."
```

### --signing-url

If provided, will be used as an API endpoint for applying [a cryptographic signature to the resulting WACZ file](https://specs.webrecorder.net/wacz-auth/0.1.0/).

This endpoint is expected to be [authsign-compatible](https://github.com/webrecorder/authsign). 

```bash
js-wacz -f "collection/*.warc.gz" --signing-url "https://example.com/sign"
```

### --signing-token

Used conjointly with `--signing-url` if provided, in case the signing server requires authentication.

```bash
js-wacz -f "collection/*.warc.gz" --signing-url "https://example.com/sign" --signing-token "FOO-BAR"
```

### --log-level

Can be used to determine how verbose **js-wacz** needs to be.

- Possible values are: `silent`, `trace`, `debug`, `info`, `warn`, `error`
- Default is: `info`

```bash
js-wacz -f "collection/*.warc.gz" --log-level trace
```


[👆 Back to summary](#summary)

---

## Programmatic use

**js-wacz**'s CLI and underlying logic are decoupled, and it can therefore be consumed as a JavaScript module _(currently only with Node.js)_.

**Example: Creating a signed WACZ programmatically**
```javascript
import { WACZ } from '@harvard-lil/js-wacz'

try {
  const archive = new WACZ({ 
    file: 'collection/*.warc.gz',
    output: 'collection.wacz',
    signingUrl: 'https://example.com/sign',
    signingToken: 'FOO-BAR',
  }

  await archive.process()

  // collection.wacz is ready
} catch(err) {
  // ...
}
```

Although a `process()` convenience method is made available, every step of said process can be run individually and the archive's state inspected / edited throughout.

### Notable affordances
- `WACZ.addPage()` allows for manually adding an entry to `pages.jsonl`.
- `WACZ.addFileToZip()` allows for manually adding any additional data to the final WACZ file.
- The `datapackageExtras` option allows for adding an arbitrary JSON-serializable object to datapackage.json under `extras`. 

### References:
- [WACZ Class](https://github.com/harvard-lil/js-wacz/blob/main/index.js)
- [Available options](https://github.com/harvard-lil/js-wacz/blob/main/types.js)

[👆 Back to summary](#summary)


---

## Feature parity with py-wacz

**js-wacz** is aiming at partial feature parity with [webrecorder's py-wacz](https://specs.webrecorder.net/wacz/1.1.1/), similar to [Webrecorder's py-wacz](https://github.com/webrecorder/py-wacz). 

This section lists notable differences in implementation that might affect interoperability. 

**Main differences in currently implemented features:**
- **CLI:** `create --detect-pages`: `--detect-pages` is implied in **js-wacz** unless `--pages` is provided.
- **CLI:** `create --file`: that argument can be implied in **py-wacz**, it is always explicit in **js-wacz**.

[👆 Back to summary](#summary)

---

## Development

### Standard JS
This codebase uses the [Standard JS](https://standardjs.com/) coding style. 
- `npm run lint` can be used to check formatting.
- `npm run lint-autofix` can be used to check formatting _and_ automatically edit files accordingly when possible.
- Most IDEs can be configured to automatically check and enforce this coding style.

### JSDoc
[JSDoc](https://jsdoc.app/) is used for both documentation and loose type checking purposes on this project.

### Testing
This project uses [Node.js' built-in test runner](https://nodejs.org/api/test.html).

```bash
npm run test
```

#### Tests-specific environment variables
The following environment variables allow for testing features requiring access to a third-party server. 

These are optional, and can be added to a local `.env` file which will be automatically interpreted by the test runner. 

| Name | Description |
| --- | --- |
| `TEST_SIGNING_URL` | Url of an [authsign-compatible endpoint](https://github.com/webrecorder/authsign) for signing WACZ files. | 
| `TEST_SIGNING_TOKEN` | If required by the server at `TEST_SIGNING_URL`, an authentication token. |

[👆 Back to summary](#summary)

