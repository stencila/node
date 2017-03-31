/* globals Blob */
const fs = require('fs')
const path = require('path')

class FileSystemBuffer {

  constructor (archivePath) {
    this.archivePath = archivePath
    // If buffer root does not exit, create it
    // This allows to write to not yet existing folders
    if (!fs.existsSync(archivePath)) {
      fs.mkdirSync(archivePath)
    }
  }

  /*
    Reads a file from the buffer

    Returns a string when isText is true, for binary data a Blob object
  */
  readFile (filePath, mimeType) {
    return new Promise((resolve, reject) => {
      if (mimeType.indexOf('text/') < 0 && mimeType.indexOf('application/json') < 0) {
        return reject(new Error('FileSystemBuffer only supports reading text and json'))
      }
      fs.readFile(path.join(this.archivePath, filePath), 'utf8', (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  }

  /*
    File data must either be a utf8 string or a blob object
  */
  writeFile(filePath, mimeType, data) {
    return new Promise((resolve, reject) => {
      if (typeof data === 'string') {
        fs.writeFile(path.join(this.archivePath, filePath), data, 'utf8', (err) => {
          /* istanbul ignore next */
          if (err) reject(err)
          else resolve(this)
        })
      }
      /* istanbul ignore next */ // Can't be tested under Node
      else if (typeof Blob !== 'undefined' && data instanceof Blob) reject(new Error('FileSystemBuffer does not support writing blobs yet'))
      else reject(new Error('FileSystemBuffer only supports writing utf-8 strings and blobs'))
    })
  }
}

module.exports = FileSystemBuffer
