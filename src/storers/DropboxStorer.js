const path = require('path')
const pump = require('pump')
const request = require('request')
var unzip = require('unzip-stream')

const FileStorer = require('./FileStorer')

class DropboxStorer extends FileStorer {

  constructor (options) {
    let path_ = options.path
    if (options.version) throw new Error('It is invalid to specify a version with the dropbox:// protocol')

    super({
      path: path.join(require('../host/Host').userDir(), 'stores', 'dropbox', path_)
    })
    this._url = `https://dropbox.com/sh/${path_}?dl=1`
    this._initialized = false
  }

  initialize () {
    return new Promise((resolve) => {
      if (this._initialized) return resolve()
      else {
        var source = request.get(this._url)
        var sink = unzip.Extract({ path: this._dir })
        pump(source, sink, () => {
          this._initialized = true
          setTimeout(resolve, 10)
        })
      }
    })
  }

  writeFile() {
    return Promise.reject(
      new Error('Writing not supported by DropboxStorer')
    )
  }

}

DropboxStorer.spec = {
  name: 'DropboxStorer',
  base: 'Storer',
  protocol: ['dropbox']
}

module.exports = DropboxStorer
