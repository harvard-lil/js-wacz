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

**js-wacz** makes use of workers to process as many WARC files in parallel as the host machine can handle.

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

<details>
<summary><h3>--file, -f</h3></summary>

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
</details>

<details>
<summary><h3>--output, -o</h3></summary>

Allows to specify where the resulting `.wacz` file should be created, and what its filename should be.

Defaults to `archive.wacz` if not provided.

```bash
js-wacz --file cool-beans.warc --output cool-beans.wacz
```
</details>

<details>
<summary><h3>--pages, -p</h3></summary>

Allows to pass a specific [pages.jsonl](https://specs.webrecorder.net/wacz/1.1.1/#pages-jsonl) file. 

If not provided, **js-wacz** is going to attempt to detect pages in WARC records to build its own `pages.jsonl` index.

```bash
js-wacz -f "collection/*.warc.gz" --pages collection/pages.jsonl
```
</details>

<details>
<summary><h3>--url</h3></summary>

If provided, will be used as the [`mainPageUrl` attribute for `datapackage.json`](https://specs.webrecorder.net/wacz/1.1.1/#datapackage-json).

Must be a valid URL.

```bash
js-wacz -f "collection/*.warc.gz" --url "https://lil.law.harvard.edu"
```
</details>

<details>
<summary><h3>--ts</h3></summary>

If provided, will be used as the [`mainPageDate` attribute for `datapackage.json`](https://specs.webrecorder.net/wacz/1.1.1/#datapackage-json).

Can be any value [that can be parsed by JavaScript's `Date() constructor`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date).

```bash
js-wacz -f "collection/*.warc.gz" --ts "2023-02-22T12:00:00.000Z"
```
</details>

<details>
<summary><h3>--title</h3></summary>

If provided, will be used as the [`title` attribute for `datapackage.json`](https://specs.webrecorder.net/wacz/1.1.1/#datapackage-json).

```bash
js-wacz -f "collection/*.warc.gz" --title "My collection."
```
</details>

<details>
<summary><h3>--desc</h3></summary>

If provided, will be used as the [`description` attribute for `datapackage.json`](https://specs.webrecorder.net/wacz/1.1.1/#datapackage-json).

```bash
js-wacz -f "collection/*.warc.gz" --desc "My cool collection of web archives."
```
</details>

<details>
<summary><h3>--signing-url</h3></summary>

If provided, will be used as an API endpoint for applying [a cryptographic signature to the resulting WACZ file](https://specs.webrecorder.net/wacz-auth/0.1.0/).

This endpoint is expected to be [authsign-compatible](https://github.com/webrecorder/authsign). 

```bash
js-wacz -f "collection/*.warc.gz" --signing-url "https://example.com/sign"
```
</details>

<details>
<summary><h3>--signing-token</h3></summary>

Used conjointly with `--signing-url` if provided, in case the signing server requires authentication.

```bash
js-wacz -f "collection/*.warc.gz" --signing-url "https://example.com/sign" --signing-token "FOO-BAR"
```
</details>

<details>
<summary><h3>--log-level</h3></summary>

Can be used to determine how verbose **js-wacz** needs to be.

- Possible values are: `silent`, `trace`, `debug`, `info`, `warn`, `error`
- Default is: `info`

```bash
js-wacz -f "collection/*.warc.gz" --log-level trace
```
</details>

[👆 Back to summary](#summary)

---

## Programmatic use

**js-wacz**'s CLI and underlying logic are decoupled, and it can therefore be consumed as a JavaScript module (currently only with NodeJS).

**Example: Creating a signed WACZ programmatically**
```javascript
import { WACZ } from 'js-wacz'

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

### References:
- [WACZ Class](https://github.com/harvard-lil/js-wacz/blob/main/index.js#L40)
- [Available options](https://github.com/harvard-lil/js-wacz/blob/main/types.js#L3)

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
