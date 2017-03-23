const FileSystemBackend = require('./src/backend/FileSystemBackend')
const FileSystemBuffer = require('./src/backend/FileSystemBuffer')

const host = require('./src/host/singletonHost')
const util = require('./src/util')
const version = require('./package').version

module.exports = {
  FileSystemBackend,
  FileSystemBuffer,
  host: host,
  util: util,
  version: version
}
