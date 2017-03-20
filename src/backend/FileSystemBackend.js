const FolderArchive = require('./FolderArchive')
const path = require('path')
const fs = require('fs')
const DocumentHTMLConverter = require('./DocumentHTMLConverter')
const FileSystemStorer = require('./FileSystemStorer')
const { uuid } = require('stencila')

// Available converters
const CONVERTERS = [
  DocumentHTMLConverter
]

class FileSystemBackend {

  constructor (userLibraryDir) {
    this.userLibraryDir = userLibraryDir
  }

  /*
    Reads a file from the file system (e.g. HTML or Markdown) converts it into
    a Stencila archive and adds it to the library.

    NOTE: We hard-code the FileSystemStorer for now
  */
  importFile(filePath) {
    let sourceDir = path.dirname(filePath)
    let sourceArchive = new FileSystemStorer(sourceDir)
    let fileName = path.basename(filePath)
    let converter = this._getConverter(fileName)
    let documentId = uuid()
    let documentPath = path.join(this.userLibraryDir, documentId)
    let internalArchive = new FolderArchive(documentPath)
    return converter.importDocument(
      sourceArchive,
      internalArchive,
      sourceDir,
      fileName
    ).then((manifest) => {
      return this._createLibraryRecord(documentId, manifest)
    }).then(() => {
      return documentId
    })
  }

  /*
    Create a new document (used by the dashboard)

    Takes an html template and an optional documentId
  */
  createDocument(html, documentId) {
    documentId = documentId || uuid()
    let documentPath = path.join(this.userLibraryDir, documentId)
    let storageDir = path.join(documentPath, 'storage')
    let internalArchive = new FolderArchive(documentPath)
    let sourceArchive = new FileSystemStorer(storageDir)
    let manifest = {
      "type": "document",
      "storage": {
        "storerType": "filesystem",
        "contentType": "html",
        "folderPath": storageDir,
        "fileName": 'index.html'
      },
      "title": "No title available yet",
      "createdAt": new Date().toJSON(),
      "updatedAt": new Date().toJSON()
    }

    return internalArchive.writeFile(
      'index.html',
      'text/html',
      html
    ).then(() => {
      return sourceArchive.writeFile('index.html', 'text/html', html)
    }).then(() => {
      return internalArchive.writeFile(
        'stencila-manifest.json',
        'application/json',
        JSON.stringify(manifest, null, '  ')
      )
    }).then(() => {
      // Library record is a weak copy of the document manifest
      return this._createLibraryRecord(documentId, manifest)
    })
  }

  /*
    Takes an internal archive and stores it in the original location. This step
    may involve conversion. E.g. when the content type is Markdown
  */
  storeArchive(internalArchive) {
    return internalArchive.readFile(
      'stencila-manifest.json',
      'application/json'
    ).then((manifest) => {
      manifest = JSON.parse(manifest)
      let folderPath = manifest.storage.folderPath
      let fileName = manifest.storage.fileName
      let converter = this._getConverter(fileName)
      let storer = new FileSystemStorer(folderPath)
      return converter.exportDocument(internalArchive, storer, folderPath, fileName)
    })
  }

  _createLibraryRecord(documentId, manifest) {
    return this.getLibrary().then((libraryData) => {
      libraryData[documentId] = manifest
      return this._writeLibrary(libraryData)
    })
  }

  /*
    Analyzes the given filePath to match a suitable
    converter.
  */
  _getConverter(filePath) {
    let converter
    for (var i = 0; i < CONVERTERS.length && !converter; i++) {
      let ConverterClass = CONVERTERS[i]
      if (ConverterClass.match(filePath)) {
        converter = new ConverterClass()
      }
    }
    return converter
  }

  /*
    Reads and parses the library file. If it does not exist, it will be created
    within userLibraryDir.
  */
  getLibrary() {
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

  _writeLibrary(libraryData) {
    let libraryPath = path.join(this.userLibraryDir, 'library.json')
    return new Promise((resolve, reject) => {
      fs.writeFile(libraryPath, JSON.stringify(libraryData, null, '  '), 'utf8', (err) => {
        if (err) {
          return reject(err)
        } else {
          resolve(this)
        }
      })
    })
  }

  /*
    Returns a list of document entries to power the dashboard UI

    Should be sorted by openedAt
  */
  listDocuments () {
    return this.getLibrary().then((libraryData) => {
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
