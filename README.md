## `stencila/js`

[![Build status](https://travis-ci.org/stencila/js.svg?branch=master)](https://travis-ci.org/stencila/js)
[![Code coverage](https://codecov.io/gh/stencila/js/branch/master/graph/badge.svg)](https://codecov.io/gh/stencila/js)
[![Dependency status](https://david-dm.org/stencila/js.svg)](https://david-dm.org/stencila/js)
[![Chat](https://badges.gitter.im/stencila/stencila.svg)](https://gitter.im/stencila/stencila)

Stencila components for Javascript.

### Development

Most development tasks can be run directly using Javascript tooling (`npm` etc) or via `make` wrapper recipes.

Task                                                    |`npm` et al            | `make`          |
------------------------------------------------------- |-----------------------|-----------------|    
Install and setup dependencies                          | `npm install`         | `make setup`
Check code for lint                                     | `npm run lint`        | `make lint`
Run tests                                               | `npm test`            | `make test`
Run tests with coverage                                 | `npm run cover`       | `make cover`
Clean                                                   |                       | `make clean`

#### Testing

Tests live in the `tests` folder and are written using the [`tape`](https://github.com/substack/tape) test harness.
