const { MemoryArchive } = require('stencila')
const fs = require('fs')
const path = require('path')

class FolderArchive extends MemoryArchive {

  constructor (archiveURL) {
    super()
    this.archiveURL = archiveURL
  }

  /*
    Reads a file from the archive

    Returns a string when isText is true, for binary data a Blob object
  */
  readFile (filePath, isText) {
    return new Promise((resolve, reject) => {
      if (!isText) {
        return reject(new Error('Binary data not yet supported'))
      }

      // Provide file from memory when available
      if (this._files[filePath]) {
        resolve(this._files[filePath])
      }

      fs.readFile(path.join(this.archiveURL, path), 'utf8', (err, data) => {
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
          fs.writeFileSync(filePath, fileData, 'utf8')
        })
      } catch(err) {
        reject(err)
      }
      resolve()
    })
  }
}

/*
  TODO: do actual checking for file protocol or analyze url if really
  a folder.
*/
FolderArchive.matchURL = function(url) {
  if (url.indexOf('.stencila')) {
    return true
  }
  return false
}

module.exports = FolderArchive
