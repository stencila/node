const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const untildify = require('untildify')

class FileStorer {

  constructor (options = {}) {
    this._path = options.path ? untildify(options.path) : '/'
    if (this._path && !fs.existsSync(this._path)) mkdirp.sync(this._path)
    this._buffers = {}
  }

  initialize () {
    return Promise.resolve()
  }

  readBuffer(path) {
    return this.initialize().then(() => {
      let buffer = this._buffers[path]
      if (buffer) return buffer
      else throw new Error('Buffer not found')
    })
  }

  writeBuffer(path, data) {
    return this.initialize().then(() => {
      this._buffers[path] = data
    })
  }

  discardBuffer(path) {
    return this.initialize().then(() => {
      delete this._buffers[path]
    })
  }

  discardBuffers() {
    return this.initialize().then(() => {
      this._buffers = {}
    })
  }

  readFile (path_) {
    return this.initialize().then(() => {
      return new Promise((resolve, reject) => {
        if (path_ !== this._path) path_ = path.join(this._path, path_)
        fs.readFile(path_, 'utf8', (err, content) => {
          if (err) reject(err)
          else resolve(content)
        })
      })
    })
  }

  writeFile(path_, content) {
    return this.initialize().then(() => {
      if (path_ !== this._path) path_ = path.join(this._path, path_)
      fs.writeFile(path_, content, 'utf8', (err) => {
        if (err) throw err
      })
    })
  }

  resolveMain() {
    return this.initialize().then(() => {
      const stats = fs.statSync(this._path)
      if (stats.isDirectory(this._path)) {
        const files = fs.readdirSync(this._path)
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
        // Fallback to the first file
        if (!main) file = this.listFiles()[0]
        return file
      } else {
        return this._path
      }
    })
  }

  listFiles() {
    return this.initialize().then(() => {
      return []
    })
  }

}

FileStorer.spec = {
  name: 'FileStorer',
  base: 'Storer',
  aliases: ['file']
}

module.exports = FileStorer
