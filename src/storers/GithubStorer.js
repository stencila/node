const gunzip = require('gunzip-maybe')
const path = require('path')
const pump = require('pump')
const request = require('request')
const stripDirs = require('strip-dirs')
const tar = require('tar-fs')

const FileStorer = require('./FileStorer')

class GithubStorer extends FileStorer {

  constructor (loction) {
    var match = loction.match(/^([^/]+)\/([^/@]+)(\/([^@]+))?(@(.+))?/)
    if (!match) throw new Error('Location does not appear to be valid for the github:// protocol')
    const user = match[1]
    const repo = match[2]
    const dir = match[4] || ''
    const ref = match[6] || 'master'

    const repoDir = path.join(require('../host/Host').userDir(), 'stores', 'github', user, repo, ref)
    const locationDir = path.join(repoDir, dir)

    super(locationDir)
    this._repoDir = repoDir
    this._url = `https://github.com/${user}/${repo}/tarball/${ref}`
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
          resolve(this._dir)
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
