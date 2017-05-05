const FileSystemBuffer = require('./FileSystemBuffer')

/**
 * A storer for the local file system
 */
class FileSystemStorer extends FileSystemBuffer {
  constructor (archivePath, mainFilePath, isExternal) {
    super(archivePath)
    this.mainFilePath = mainFilePath
    this._isExternal = isExternal
  }

  match() {
    return true
  }

  getArchivePath() {
    return this.archivePath
  }

  getMainFilePath() {
    return this.mainFilePath
  }

  isExternal() {
    return this._isExternal
  }

  getType() {
    return 'filesystem'
  }
}

module.exports = FileSystemStorer
