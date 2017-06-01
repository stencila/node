const FileSystemBackend = require('./src/backend/FileSystemBackend')
const FileSystemBuffer = require('./src/backend/FileSystemBuffer')

const host = require('./src/host/singletonHost')
const util = require('./src/util')

// Various shortuct functions and variables providing a similar interface
// to the package as in other Stencila language packages 
// e.g. https://github.com/stencila/r/blob/master/R/main.R

const version = require('./package').version

const install = function (...args) {
  return host.install(...args)
}
const environ = function () {
  return console.log(JSON.stringify(host.environ(), null, '  ')) // eslint-disable-line no-console
}
const start = function (...args) {
  return host.start(...args)
}
const stop = function (...args) {
  return host.stop(...args)
}
const run = function (...args) {
  return host.run(...args)
}

module.exports = {
  FileSystemBackend,
  FileSystemBuffer,
  host: host,
  util: util,

  version: version,
  install: install,
  environ: environ,
  start: start,
  stop: stop,
  run: run
}
