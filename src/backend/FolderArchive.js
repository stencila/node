const { MemoryArchive } = require('stencila')
const fs = require('fs')
const path = require('path')

class FolderArchive extends MemoryArchive {

  constructor (folderPath) {
    super()
    this.folderPath = folderPath
  }

  /*
    Reads a file from the archive

    Returns a string when isText is true, for binary data a Blob object
  */
  readFile (filePath, mimeType) {
    return new Promise((resolve, reject) => {
      if (mimeType.indexOf('text/') < 0) {
        return reject(new Error('Binary data not yet supported'))
      }

      // Provide file from memory when available
      if (this._files[filePath]) {
        resolve(this._files[filePath])
      }

      fs.readFile(path.join(this.folderPath, filePath), 'utf8', (err, data) => {
        if (err) {
          return reject(err)
        }
        this._files[filePath] = data
        resolve(data)
      })
    })
  }

  /*
    TODO: Support writing blob files as well
  */
  save () {
    return new Promise((resolve, reject) => {
      try {
        Object.keys(this._files).forEach((filePath) => {
          let fileData = this._files[filePath].data
          fs.writeFileSync(path.join(this.folderPath, filePath), fileData, 'utf8')
        })
      } catch(err) {
        reject(err)
      }
      resolve()
    })
  }
}


module.exports = FolderArchive
