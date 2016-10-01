'use strict';

const fs = require('fs');
const pathm = require('path');
const mkdirp = require('mkdirp');

class Component {

  constructor (path) {
    path = path || ''

    this._path = path
    try {
      fs.statSync(path)
      this.read(path)
    } catch (err) {
      // eslint-disable empty-block
    }
  }

  path () {
    return this._path
  }

  read (path) {
    if (!path || path == '') {
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
    if (!path || path == '') {
      path = this._path
    }

    mkdirp.sync(pathm.extname(path) === '' ? path : pathm.dirname(path))

    this._path = path

    return path
  }

}

module.exports = Component;
