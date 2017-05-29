const FileSystemBackend = require('./src/backend/FileSystemBackend')
const FileSystemBuffer = require('./src/backend/FileSystemBuffer')

const host = require('./src/host/singletonHost')
const util = require('./src/util')

// Various shortuct functions and variables providing a similar interface
// to the package as in other Stencila language packages 
// e.g. https://github.com/stencila/r/blob/master/R/main.R

const version = require('./package').version

const install = function () {
  return host.install()
}
const environ = function () {
  return JSON.stringify(host.environ(), null, '  ')
}
const start = function (address='127.0.0.1', port=2000) {
  return host.start(address, port)
}
const stop = function () {
  return host.stop()
}
const run = function () {
  return host.run()
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
