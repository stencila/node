## `stencila/node` : Stencila for Node.js

[![NPM](http://img.shields.io/npm/v/stencila-node.svg?style=flat)](https://www.npmjs.com/package/stencila-node)
[![Build status](https://travis-ci.org/stencila/node.svg?branch=master)](https://travis-ci.org/stencila/node)
[![Code coverage](https://codecov.io/gh/stencila/node/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/node)
[![Dependency status](https://david-dm.org/stencila/node.svg)](https://david-dm.org/stencila/node)
[![Chat](https://badges.gitter.im/stencila/stencila.svg)](https://gitter.im/stencila/stencila)

Provides a Node.js execution context. Also includes backend services for Stencila user intefarces including [`stencila/desktop`](https://github.com/stencila/desktop).

### Install

```sh
npm install stencila-node
```

### Use

Run the `stencila-node` script,

```sh
./node_modules/.bin/stencila-node
```

This will serve a `Host` on localhost which will be asked by Stencila user interfaces to create a new `NodeContext` when necessary.

Documentation is available at https://stencila.github.io/node.


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

To get started, read our contributor [code of conduct](CONDUCT.md), then [get in touch](https://gitter.im/stencila/stencila), checkout the [platform-wide, cross-repository kanban board](https://github.com/orgs/stencila/projects/1) or just send in a pull request!

Docs are published using Github Pages, so to update them after making changes run `make docs`, commit the updated docs and do a `git push`.
