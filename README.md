## `stencila/node` : Stencila for Node.js

[![Build status](https://travis-ci.org/stencila/node.svg?branch=master)](https://travis-ci.org/stencila/node)
[![Code coverage](https://codecov.io/gh/stencila/node/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/node)
[![Dependency status](https://david-dm.org/stencila/node.svg)](https://david-dm.org/stencila/node)
[![Chat](https://badges.gitter.im/stencila/stencila.svg)](https://gitter.im/stencila/stencila)

### Status

![](http://blog.stenci.la/wip.png)

This is very much a work in progress. See our [main repo](https://github.com/stencila/stencila) for more details.

### Install

```
npm install stencila
```

### Discuss

We love feedback. Create a [new issue](https://github.com/stencila/node/issues/new), add to [existing issues](https://github.com/stencila/node/issues) or [chat](https://gitter.im/stencila/stencila) with members of the community.


### Develop

Most development tasks can be run directly from `npm` or via `make` wrapper recipes.

Task                                                    |`npm` et al            | `make`          |
------------------------------------------------------- |-----------------------|-----------------|    
Install and setup dependencies                          | `npm install`         | `make setup`
Check code for lint                                     | `npm run lint`        | `make lint`
Run tests                                               | `npm test`            | `make test`
Run tests with coverage                                 | `npm run cover`       | `make cover`
Build documentation                                     | `npm run docs`        | `make docs`
Serve and watch docs for updates                        | `npm run docs-serve`  | `make docs-serve`
Clean                                                   |                       | `make clean`

Tests live in the `tests` folder and are written using the [`tape`](https://github.com/substack/tape) test harness.
