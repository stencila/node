const promisify = require('promisify-node')

const fs = promisify('fs')
const path = require('path')
const untildify = require('untildify')

class FileStorer {

  constructor (options = {}) {
    let path_ = options.path || '/'

    path_ = untildify(path_)
    let isdir
    if (fs.existsSync(path_)) {
      isdir = fs.lstatSync(path_).isDirectory()
    } else {
      isdir = path.extname(path_) === ''
    }
    this._dir = isdir ? path_ : path.dirname(path_)
    this._main = isdir ? null : path.basename(path_)
  }

  initialize () {
    return Promise.resolve()
  }

  getDirectory() {
    return Promise.resolve(this._dir)
  }

  getMain() {
    return Promise.resolve(this._main)
  }

  getFiles() {
    return this.initialize().then(() => {
      return fs.readdir(this._dir)
    })
  }

  getInfo() {
    return this.getFiles().then((files) => {
      return {
        dir: this._dir,
        main: this._main,
        files: files
      }
    })    
  }

  filePath (path_) {
    return this.initialize().then(() => {
      return path.join(this._dir, path_)
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

  deleteFile(path_) {
    return this.initialize().then(() => {
      return fs.unlink(path.join(this._dir, path_))
    })
  }

}

FileStorer.spec = {
  name: 'FileStorer',
  base: 'Storer',
  aliases: ['file']
}

module.exports = FileStorer
