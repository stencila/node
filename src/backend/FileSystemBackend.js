const FolderArchive = require('./FolderArchive')
const path = require('path')
const fs = require('fs')

class FileSystemBackend {

  constructor (userLibraryDir) {
    this.userLibraryDir = userLibraryDir
  }

  /*
    Reads and parses the library file. If it does not exist, it will be created within
    userLibraryDir.
  */
  _getLibrary () {
    let libraryPath = path.join(this.userLibraryDir, 'library.json')

    return new Promise((resolve, reject) => {
      fs.readFile(libraryPath, 'utf8', (err, data) => {
        if (err) {
          return reject(err)
        } else {
          resolve(JSON.parse(data))
        }
      })
    })
  }

  /*
    Returns a list of document entries to power the dashboard UI

    Should be sorted by openedAt
  */
  listDocuments () {
    return this._getLibrary().then((libraryData) => {
      let documentEntries = []

      Object.keys(libraryData).forEach((address) => {
        let doc = libraryData[address]
        documentEntries.push({
          type: doc.type,
          address: address,
          title: doc.title,
          openedAt: doc.openedAt,
          createAt: doc.modifiedAt,
          modifiedAt: doc.modifiedAt
        })
      })
      return documentEntries
    })
  }

  /*
    Returns an archive object.

    TODO: We should support other archive types than FolderArchive.
          E.g. MarkdownArchive (represented by a .md file on disk)
  */
  getArchive (documentId) {
    return new Promise((resolve) => {
      resolve(new FolderArchive(path.join(this.userLibraryDir, documentId)))
    })
  }
}

module.exports = FileSystemBackend
