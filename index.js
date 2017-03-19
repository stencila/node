const FileSystemBackend = require('./src/backend/FileSystemBackend')
const FolderArchive = require('./src/backend/FolderArchive')

const host = require('./src/host/singletonHost')
const util = require('./src/util')
const version = require('./package').version

module.exports = {
  FileSystemBackend,
  FolderArchive,

  host: host,
  util: util,
  version: version
}
