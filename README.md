> 🚧 🚧 🚧

# js-wacz 

[![npm version](https://badge.fury.io/js/@harvard-lil%2Fjs-wacz.svg)](https://badge.fury.io/js/@harvard-lil%2Fjs-wacz) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

JavaScript module and CLI tool for working with web archive data using [the WACZ format specification](https://specs.webrecorder.net/wacz/1.1.1/), similar to [Webrecorder's py-wacz](https://github.com/webrecorder/py-wacz).

It can be used to combine a set of `.warc` / `.warc.gz` files into a single `.wacz` file:

**... programmatically (Node JS):**
```javascript
import { WACZ } from "js-wacz"

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

`js-wacz` makes use of workers to process as many WARC files in parallel as the host machine can handle.

---

## Summary
- [Install](#install)
- [CLI: `create` command](#cli-create-command)
- [Programmatic use](#programmatic-use)
- [Feature parity with py-wacz](#feature-parity-with-py-wacz)
- [Development](#development)
- [TODOs](#todos)

---

## Install

`js-wacz` requires [Node JS 18+](https://nodejs.org/en/). 

`npm` can be used to install this package and make the `js-wacz` command accessible system-wide:

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

`js-wacz` accepts the following options and arguments for customizing how the WACZ file is assembled.

### --file, -f

This is the only **required** argument, which indicates what file(s) should be processed and added to the resulting WACZ file.

The target can be a single file, or a glob pattern such as `folder/*.warc.gz`. 

```bash
js-wacz --file archive.warc
js-wacz --file "collection/*.warc"
```

**Note:** When using globs, make sure to surround the path with quotation marks.


### --output, -o

Allows to specify where the resulting `.wacz` file should be created, and what its filename should be.

Defaults to `archive.wacz` if not provided.

```bash
js-wacz --file cool-beans.warc --output cool-beans.wacz
```

### --pages, -p

Allows to pass a specific [pages.jsonl](https://specs.webrecorder.net/wacz/1.1.1/#pages-jsonl) file. 

If not provided, `js-wacz` is going to attempt to detect pages in WARC records to build its own `pages.jsonl` index.

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

Can be used to determine how verbose `js-wacz` needs to be.

- Possible values are: `silent`, `trace`, `debug`, `info`, `warn`, `error`
- Default is: `info`

```bash
js-wacz -f "collection/*.warc.gz" --log-level trace
```

[👆 Back to summary](#summary)

---

## Programmatic use

[👆 Back to summary](#summary)


---

## Feature parity with py-wacz

[👆 Back to summary](#summary)

---

## Development

[👆 Back to summary](#summary)

---

## TODOs

[👆 Back to summary](#summary)
