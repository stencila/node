const FileSystemBuffer = require('./FileSystemBuffer')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const FileSystemStorer = require('./FileSystemStorer')
const { 
  uuid, 
  DocumentHTMLConverter, 
  DocumentMarkdownConverter,
  DocumentJupyterConverter,
  DocumentRMarkdownConverter
} = require('stencila')

// Available converters
const CONVERTERS = [
  DocumentHTMLConverter,
  DocumentMarkdownConverter,
  DocumentJupyterConverter,
  DocumentRMarkdownConverter
]

/**
 * A backend for the local file system
 */
class FileSystemBackend {

  constructor (userLibraryDir) {
    this.userLibraryDir = userLibraryDir
  }

  /*
    Reads a file from the file system (e.g. HTML or Markdown) converts it into
    a Stencila buffer and adds it to the library.

    NOTE: We hard-code the FileSystemStorer for now
  */
  importFile(filePath) {
    let storageArchivePath = path.dirname(filePath)
    let mainFileName = path.basename(filePath)
    let storer = new FileSystemStorer(storageArchivePath, mainFileName, 'external')
    let converter = this._getConverter(mainFileName)
    let documentId = uuid()
    let documentPath = path.join(this.userLibraryDir, documentId)
    let buffer = new FileSystemBuffer(documentPath)
    return converter.importDocument(
      storer,
      buffer
    ).then((manifest) => {
      return this._setLibraryRecord(documentId, manifest)
    }).then(() => {
      return documentId
    })
  }

  /*
    Create a new document (used by the dashboard)

    Takes an html template and an optional documentId

    TODO: should extract the title from the source file
  */
  createDocument(html, documentId) {
    documentId = documentId || uuid()
    let documentPath = path.join(this.userLibraryDir, documentId)
    let storageArchivePath = path.join(documentPath, 'storage')
    let buffer = new FileSystemBuffer(documentPath)
    let mainFileName = 'index.html'
    let storer = new FileSystemStorer(storageArchivePath, mainFileName)
    let converter = this._getConverter(mainFileName)

    return storer.writeFile('index.html', 'text/html', html).then(() => {
      return converter.importDocument(
        storer,
        buffer
      ).then((manifest) => {
        return this._setLibraryRecord(documentId, manifest)
      }).then(() => {
        return documentId
      })
    })
  }

  deleteDocument(documentId) {
    let documentPath = path.join(this.userLibraryDir, documentId)
    return new Promise((resolve, reject) => {
      rimraf(documentPath, (err) => {
        if (err) {
          reject(err)
        } else {
          this._deleteLibraryRecord(documentId).then(() => {
            resolve()
          })
        }
      })
    })
  }

  /*
    Takes an internal buffer and stores it in the original location. This step
    involves conversion. E.g. when the content type is Markdown
  */
  storeBuffer(buffer) {
    return buffer.readFile(
      'stencila-manifest.json',
      'application/json'
    ).then((manifest) => {
      manifest = JSON.parse(manifest)
      let archivePath = manifest.storage.archivePath
      let mainFilePath = manifest.storage.mainFilePath
      let converter = this._getConverter(mainFilePath)
      let storer = new FileSystemStorer(archivePath, mainFilePath)
      return converter.exportDocument(buffer, storer)
    })
  }

  /*
    Discards unsaved changes and restores from the latest stored version
  */
  discardBuffer(buffer, documentId) {
    return buffer.readFile(
      'stencila-manifest.json',
      'application/json'
    ).then((manifest) => {
      manifest = JSON.parse(manifest)
      let archivePath = manifest.storage.archivePath
      let mainFilePath = manifest.storage.mainFilePath
      let converter = this._getConverter(mainFilePath)
      let storer = new FileSystemStorer(archivePath, mainFilePath)
      return converter.importDocument(storer, buffer).then((manifest) => {
        return this._setLibraryRecord(documentId, manifest)
      })
    })
  }

  _setLibraryRecord(documentId, manifest) {
    return this.getLibrary().then((libraryData) => {
      libraryData[documentId] = manifest
      return this._writeLibrary(libraryData)
    })
  }

  _deleteLibraryRecord(documentId) {
    return this.getLibrary().then((libraryData) => {
      delete libraryData[documentId]
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
        /* istanbul ignore next */
        if (err) reject(err)
        else resolve(JSON.parse(data))
      })
    })
  }

  _writeLibrary(libraryData) {
    let libraryPath = path.join(this.userLibraryDir, 'library.json')
    return new Promise((resolve, reject) => {
      fs.writeFile(libraryPath, JSON.stringify(libraryData, null, '  '), 'utf8', (err) => {
        /* istanbul ignore next */
        if (err) reject(err)
        else resolve(this)
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
      Object.keys(libraryData).forEach((documentId) => {
        let manifest = libraryData[documentId]
        let entry = Object.assign({}, manifest, {id: documentId})
        documentEntries.push(entry)
      })
      return documentEntries
    })
  }

  /*
    Returns a Stencila buffer object.
  */
  getBuffer (documentId) {
    return new Promise((resolve) => {
      resolve(new FileSystemBuffer(path.join(this.userLibraryDir, documentId)))
    })
  }

  /*
    Updates the manifest file in the buffer as well as the weak copy in
    library.json.

    Used to update the document title when it has changed, as well as the
    updatedAt timestamp.
  */
  updateManifest(documentId, props) {
    let state = {}
    return this.getBuffer(documentId).then((buffer) => {
      state.buffer = buffer
      return buffer.readFile('stencila-manifest.json', 'application/json')
    }).then((manifest) => {
      manifest = JSON.parse(manifest)
      Object.assign(manifest, props)
      state.buffer.writeFile(
        'stencila-manifest.json',
        'application/json',
        JSON.stringify(manifest, null, '  ')
      ).then(() => {
        return this._setLibraryRecord(documentId, manifest)
      })
    })
  }
}

module.exports = FileSystemBackend
