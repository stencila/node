## Stencila for Node.js

[![NPM](http://img.shields.io/npm/v/stencila-node.svg?style=flat)](https://www.npmjs.com/package/stencila-node)
[![Build status](https://travis-ci.org/stencila/node.svg?branch=master)](https://travis-ci.org/stencila/node)
[![Code coverage](https://codecov.io/gh/stencila/node/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/node)
[![Dependency status](https://david-dm.org/stencila/node.svg)](https://david-dm.org/stencila/node)
[![Chat](https://badges.gitter.im/stencila/stencila.svg)](https://gitter.im/stencila/stencila)

### Install

```sh
npm install stencila-node -g
```

Register this Stencila package,

```
stencila-node register
```

This creates a host manifest file in the Stencila hosts directory (e.g. `~/.stencila/hosts` on Linux). This file is used by Stencila Desktop and other packages to determine which Stencila hosts you have installed on your machine.

### Use

This package lets you run JavaScript and other code from inside Stencila documents. First, you need to start serving the Stencila Host within this package. You can do that at a terminal,

```sh
stencila-node
```

or inside Node.js:

```js
const stencila = require('stencila-node')
stencila.run()
```

This will serve a Stencila `Host` on localhost. You can then open your Stencila document from within the [Stencila Desktop](https://github.com/stencila/desktop). The host will be automatically detected by the desktop app and you'll be able to execute Javascript code cells from within your documents.

API documentation is available at https://stencila.github.io/node.

### Discuss

We love feedback. Create a [new issue](https://github.com/stencila/node/issues/new), add to [existing issues](https://github.com/stencila/node/issues) or [chat](https://gitter.im/stencila/stencila) with members of the community.

### Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md).
