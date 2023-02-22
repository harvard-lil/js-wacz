> 🚧 🚧 🚧

# js-wacz 

[![npm version](https://badge.fury.io/js/@harvard-lil%2Fjs-wacz.svg)](https://badge.fury.io/js/@harvard-lil%2Fjs-wacz) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

JavaScript module and CLI tool for working with web archive data using [the WACZ format specification](https://specs.webrecorder.net/wacz/1.1.1/), similar to [py-wacz](https://github.com/webrecorder/py-wacz).

It can be used to combine a set of `.warc` / `.warc.gz` files into a single `.wacz` file:

**... programmatically (Node JS):**
```javascript
import { WACZ } from "js-wacz"

const archive = new WACZ({ 
  input: 'my-collection/*.warc.gz', 
  output: 'my-collection.wacz',
})
await archive.process() // "my-collection.wacz" is ready!
```

**... or via the command line:**
```bash
js-wacz -f "my-collection/*.warc.gz" -o "my-collection.wacz"
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

[👆 Back to summary](#summary)

---

## CLI: `create` command

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
