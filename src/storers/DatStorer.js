const fs = require('fs')
const path = require('path')
const mkdirp = require('mkdirp')
const Dat = require('dat-node')

const FileStorer = require('./FileStorer')

/**
 * A storer for [Dat](http://datproject.org)
 */
class DatStorer extends FileStorer {

  constructor (options = {}) {
    // Make the folder for dats to live in if it doesn't
    // exist yet
    const datsFolder = path.join(require('../host/Host').userDir(), 'stores', 'dat')
    if (!fs.existsSync(datsFolder)) mkdirp.sync(datsFolder)

    const key = options.path
    super(path.join(datsFolder, key))

    /**
     * The dat's key as a hex string
     * @type {string}
     */
    this._key = key
  }

  initialize () {
    return new Promise((resolve, reject) => {
      if (this._dat) return resolve(this._dat)

      Dat(this._dir, { key: this._key, latest: true }, (err, _dat) => {
        if (err) return reject(err)
        _dat.joinNetwork(err => {
          if (err) reject(err)
          if (!_dat.network.connected) {
            reject(new Error('No users currently online for that key.'))
          } else {
            this._dat = _dat
            resolve(_dat)
          }
        })
      })
    })
  }

  /**
    Read a file from the Dat
  */
  readFile (path_) {
    return this.initialize().then(dat => {
      return new Promise((resolve, reject) => {
        dat.archive.readFile(path_, 'utf8', (err, data) => {
          if (err) reject(err)
          dat.close(err => {
            if (err) reject(err)
            else resolve(data)
          })
        })
      })      
    })
  }

  /*
    Write a file to a dat
  */
  writeFile(path_, content) {
    return this.initialize().then(dat => {
      return new Promise((resolve, reject) => {
        if (!dat.writable) {
          reject(new Error('cannot write to this dat'))
        }
        dat.archive.writeFile(path_, content, 'utf8', (err) => {
          if (err) reject(err)
          resolve()
        })
      })      
    })
  }
}

DatStorer.protocol = 'dat'

module.exports = DatStorer
