var child = require('child-process-promise')
const fs = require('fs')
const os = require('os')
const pathm = require('path')
const mkdirp = require('mkdirp')

var _controller = null

class Component {

  constructor (path) {
    path = path || ''

    this._address = ''
    this._path = path
    try {
      fs.statSync(path)
      this.read(path)
    } catch (err) {
      // eslint-disable empty-block
    }
  }

  static get controller () {
    return _controller
  }

  static set controller (component) {
    _controller = component
  }

  get address () {
    return this._address
  }

  lengthen () {
    // TODO
    return this._address
  }

  shorten () {
    // TODO
    return this._address
  }

  path () {
    return this._path
  }

  read (path) {
    if (!path || path === '') {
      path = this._path
    }

    try {
      fs.statSync(path)
      this._path = path
    } catch (err) {
      if (err) throw new Error(`Filesystem path does not exist\n  path: ${path}`)
    }

    return path
  }

  write (path) {
    if (!path || path === '') {
      path = this._path
    }

    mkdirp.sync(pathm.extname(path) === '' ? path : pathm.dirname(path))

    this._path = path

    return path
  }

  get url () {
    return _controller.url + '/' + this.shorten()
  }

  view () {
    _controller.serve()
    if (os.platform() === 'linux') {
      child.exec('2>/dev/null 1>&2 xdg-open "' + this.url + '"')
    } else {
      child.exec('open "' + this.url + '"')
    }
  }

}

module.exports = Component
