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
        return reject(new Error('Binary data not yet supported'))
      }
      fs.readFile(path.join(this.archivePath, filePath), 'utf8', (err, data) => {
        if (err) {
          return reject(err)
        }
        resolve(data)
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
          if (err) {
            return reject(err)
          }
          resolve(this)
        })
      } else if (data instanceof Blob) {
        reject(new Error('Blobs are not yet supported'))
      } else {
        reject(new Error('MemoryFileSystem only supports utf-8 strings and blobs'))
      }
    })
  }
}

module.exports = FileSystemBuffer
