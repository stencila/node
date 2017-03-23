const FileSystemBuffer = require('./FileSystemBuffer')

class FileSystemStorer extends FileSystemBuffer {
  constructor (archivePath, mainFilePath, isExternal) {
    super(archivePath)
    this.mainFilePath = mainFilePath
    this._isExternal = isExternal
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
