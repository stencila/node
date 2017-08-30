const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')

const Dat = require('dat-node')

/**
 * A storer for [Dat](http://datproject.org)
 */
class DatStorer {

  constructor (home, key) {
    // Make the folder for dats to live in i it doesn't
    // exist yet
    const datsFolder = path.join(home, 'dat')
    if (!fs.existsSync(datsFolder)) mkdirp.sync(datsFolder)

    /**
     * Local filesystem path where the dat will be written
     * @type string
     */
    this.path = path.join(datsFolder, key)

    /**
     * The dat's key as a hex string
     * @type {string}
     */
    this.key = key
  }

  /**
    Read a file from the Dat
  */
  readFile (filePath) {
    return new Promise((resolve, reject) => {
      var dat = this.dat

      function readFile() {
        dat.archive.readFile(filePath, 'utf8', (err, data) => {
          if (err) return reject(err)
          dat.close(error => {
            if (error) reject(error)
            else resolve(data)
          })
        })
      }

      if (dat) readFile()
      else {
        Dat(this.path, { key: this.key, sparse: true, latest: true }, (err, _dat) => {
          if (err) return reject(err)
          
          dat = _dat
          dat.joinNetwork(error => {
            if (error) reject(error)
            
            if (!dat.network.connected) {
              reject(new Error('No users currently online for that key.'))
            } else {
              readFile()
            }
          })
        })
      }
    })
  }

  /*
    Write a file to a dat
  */
  writeFile(filePath, mimeType, data) {
    return new Promise((resolve, reject) => {
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
    })
  }
}

module.exports = DatStorer
