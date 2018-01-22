# Contributing

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

To get started, please checkout the [platform-wide, cross-repository kanban board](https://github.com/orgs/stencila/projects/1) 
or just send in a pull request!

Docs are published using Github Pages, 
so to update them after making changes run `make docs`, 
commit the updated docs and do a `git push`.

Tests are run on [Travis](https://travis-ci.org/stencila/node) 
and code coverage tracked at [Codecov](https://codecov.io/gh/stencila/node).
