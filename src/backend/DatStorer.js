const Dat = require('dat-node')

/**
 * A storer for dat
 */
class DatStorer {
  constructor (userLibraryDir, datKey, dat) {
    this.datPath = path.join(userLibraryDir, 'dats', datKey)
    this.datKey = datKey
    this.dat = dat
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
      var dat = this.dat
      if (dat) return sendFile()

      Dat(this.datPath, { key: this.datKey, sparse: true, latest:true }, (err, _dat) => {
        if (err) return reject(err)
        dat = _dat
        var stats = dat.trackStats()
        stats.get() // { files: 200, bytesLength: 100 }
        stats.peers // { total, complete }
        stats.network // { uploadSpeed, downloadSpeed }
        dat.joinNetwork(function () {
          if (stats.peers.total === 0) exit()
          console.log('network callback, connections:', dat.network.connected)
        })
      })

      function sendFile () {
        dat.archive.readFile(path.join(this.archivePath, filePath), 'utf8', (err, data) => {
          if (err) return reject(err)
          resolve(data)
        })
      }
    })
  }

  /*
    File data must either be a utf8 string or a blob object
  */
  writeFile(filePath, mimeType, data) {
    return new Promise((resolve, reject) => {
      if (typeof data === 'string') {
        var dat = this.dat
        if (dat) return writeFile()

        Dat(this.datPath, {key: this.datKey, latest: true}, (err, _dat) => {
          if (err) return reject(err)
          dat = _dat
          if (!dat.writable) {
            console.error('cannot write to this dat')
          }
          // dat.joinNetwork()
          writeFile()
        })

        function writeFile () {
          dat.archive.writeFile(filePath, data, 'utf8', (err, data) => {
            if (err) return reject(err)
            resolve(data)
          })
        }
      }
      /* istanbul ignore next */ // Can't be tested under Node
      else if (typeof Blob !== 'undefined' && data instanceof Blob) reject(new Error('FileSystemBuffer does not support writing blobs yet'))
      else reject(new Error('FileSystemBuffer only supports writing utf-8 strings and blobs'))
    })
  }

  match(key) {
    return key.indexOf('dat://') > -1
  }

  // getArchivePath() {
  //   return this.archivePath
  // }

  // getMainFilePath() {
  //   return this.mainFilePath
  // }

  // isExternal() {
  //   return this._isExternal
  // }

  getType() {
    return 'dat'
  }
}

module.exports = DatStorer
