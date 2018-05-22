## Stencila for Node.js

[![NPM](http://img.shields.io/npm/v/stencila-node.svg?style=flat)](https://www.npmjs.com/package/stencila-node)
[![Build status](https://travis-ci.org/stencila/node.svg?branch=master)](https://travis-ci.org/stencila/node)
[![Code coverage](https://codecov.io/gh/stencila/node/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/node)
[![Dependency status](https://david-dm.org/stencila/node.svg)](https://david-dm.org/stencila/node)
[![Chat](https://badges.gitter.im/stencila/stencila.svg)](https://gitter.im/stencila/stencila)

### Install

```bash
npm install stencila-node --global --python=python2.7
```

This package relies on dependencies with native add-ons (e.g. `better-sqlite3`, `xeromq`). So you will need to have `node-gyp` installed (https://github.com/nodejs/node-gyp#readme). The `--python` flag is necessary because, on OSX and Windows, `node-gyp` is only compatible with Python 2.7.

Register this Stencila package,

```
stencila-node register
```

This creates a host manifest file in the Stencila hosts directory (e.g. `~/.stencila/hosts/node.js` on Linux). This file is used by Stencila Desktop and other packages to determine which Stencila hosts you have installed on your machine.

### Use

This package lets you run JavaScript and other code from inside Stencila documents. First, you need to start serving the Stencila Host within this package. You can do that at a terminal,

```bash
stencila-node
```

or inside Node.js:

```js
const stencila = require('stencila-node')
stencila.run()
```

This will serve a Stencila `Host` on localhost. You can then open your Stencila document from within the [Stencila Desktop](https://github.com/stencila/desktop). The host will be automatically detected by the desktop app and you'll be able to execute Javascript code cells from within your documents.

You can also use this package to compile libraries of Javascript functions for use within Stencila:

```bash
stencila-node compile "~/stencila/source/libcore/"
```

This creates a minified Javascript bundle, in this example at `"~/stencila/source/libcore/libcore.min.js`

API documentation is available at https://stencila.github.io/node.

### Discuss

We love feedback. Create a [new issue](https://github.com/stencila/node/issues/new), add to [existing issues](https://github.com/stencila/node/issues) or [chat](https://gitter.im/stencila/stencila) with members of the community.

### Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md).
