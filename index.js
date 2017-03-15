const FileSystemBackend = require('./src/backend/FileSystemBackend')
const FolderArchive = require('./src/backend/FolderArchive')
const host = require('./src/host/singletonHost')
const version = require('./package').version

module.exports = {
  host: host,
  version: version,
  FileSystemBackend,
  FolderArchive
}
