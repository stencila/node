const gunzip = require('gunzip-maybe')
const path = require('path')
const pump = require('pump')
const request = require('request')
const stripDirs = require('strip-dirs')
const tar = require('tar-fs')

const FileStorer = require('./FileStorer')

class GithubStorer extends FileStorer {

  constructor (fullPath) {
    var match = fullPath.match(/^([^/]+)\/([^/]+)\/([^/]+)(\/(.+))?/)
    if (!match) throw new Error('Location does not appear to be valid for the github:// protocol')
    let repo = `${match[1]}/${match[2]}`
    let ref = match[3]
    let path_ = match[4]

    const repoDir = path.join(require('../host/Host').userDir(), 'stores', 'github', repo, ref)

    super(path.join(repoDir, path_ || ''))
    this._repoDir = repoDir
    this._url = `https://github.com/${repo}/tarball/${ref}`
    this._initialized = false
  }

  initialize () {
    return new Promise((resolve) => {
      if (this._initialized) return resolve()
      else {
        var source = request.get(this._url)
        var sink = tar.extract(this._repoDir, {
          map: function (header) {
            header.name = stripDirs(header.name, 1)
            return header
          }
        })
        pump(source, gunzip(), sink, () => {
          this._initialized = true
          resolve()
        })
      }
    })
  }

  writeFile() {
    return Promise.reject(
      new Error('Writing not supported by GithubStorer')
    )
  }

}

GithubStorer.protocol = 'github'

module.exports = GithubStorer
