const fs = require('fs')
const path = require('path')
const stencila = require('stencila')
const untildify = require('untildify')

const FileSystemStorer = require('../backend/FileSystemStorer')

class Bundle {

  constructor (address) {
    this._address = address
    this._buffer = new stencila.MemoryBuffer()
  }

  static storer (scheme) {
    const Storer = this.storers[scheme]
    if (Storer) return Storer 
    return null
  }

  static converter (path) {
    for (let Converter of this.converters) {
      if (Converter.match(path)) {
        return Converter
      }
    }
    return null
  }

  static match (address) {
    let split = stencila.address.split(address)
    let scheme = split.scheme
    let path_ = split.path
    if (scheme === 'file') {
      path_ = untildify(path_)
      const stats = fs.statSync(path_)
      if (stats.isDirectory(path_)) {
        const files = fs.readdirSync(path_)
        let main = false
        let file
        for (let name of ['main', 'index', 'README']) {
          for (file of files) {
            let parts = path.parse(file)
            if (parts.name === name) {
              main = true
              break
            }
          }
          if (main) break
        }
        if (!main) throw new Error(`No main file found in directory: ${path_}`)
        path_ = path.join(path_, file)
      }
    }
    if (this.storer(scheme) && this.converter(path_)) {
      return `${scheme}://${path_}`
    } else {
      return null
    }
  }

  import () {
    const split = stencila.address.split(this._address)
    let Storer = this.constructor.storer(split.scheme)
    let storer = new Storer(path.dirname(split.path), path.basename(split.path))
    let Converter = this.constructor.converter(split.path)
    let converter = new Converter()
    return converter.importDocument(storer, this._buffer) 
  }

  buffer () {
    return this._buffer.readFile('index.html', 'text/html').then((data) => {
      return {
        'index.html' : data
      }
    })
  }

}

Bundle.storers = {
  'file': FileSystemStorer
}
Bundle.converters = []

module.exports = Bundle
