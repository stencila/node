const promisify = require('promisify-node')

const fs = promisify('fs')
const path = require('path')
const untildify = require('untildify')

class FileStorer {

  constructor (path) {
    this._dir = untildify(path)
  }

  initialize () {
    return new Pormise ((resolve, reject) => {
      if (!fs.existsSync(this._dir) || !fs.lstatSync(this._path_).isDirectory())
        return reject(new Error("Directory does not exist"))
      resolve()
    })
  }

  getDirectory() {
    return Promise.resolve(this._dir)
  }

  readdir() {
    return this.initialize().then(() => {
      return fs.readdir(this._dir)
    })
  }

  readFile (path_) {
    return this.initialize().then(() => {
      return fs.readFile(path.join(this._dir, path_), 'utf8')
    })
  }

  writeFile(path_, content) {
    return this.initialize().then(() => {
      return fs.writeFile(path.join(this._dir, path_), content, 'utf8')
    })
  }

  unlink(path_) {
    return this.initialize().then(() => {
      return fs.unlink(path.join(this._dir, path_))
    })
  }

}

FileStorer.protocol = 'file'

module.exports = FileStorer
