const child = require('child-process-promise')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const mkdirp = require('mkdirp')

const version = require('../../package').version
const ComponentDataConverter = require('./ComponentDataConverter')
const ComponentJsonConverter = require('./ComponentJsonConverter')
const ComponentHtmlConverter = require('./ComponentHtmlConverter')
const ComponentHtmlHeadConverter = require('./ComponentHtmlHeadConverter')
const ComponentHtmlBodyConverter = require('./ComponentHtmlBodyConverter')


var _host = null

/**
 * The abstract base class for all Stencila components
 *
 * @class Component
 */
class Component {

  /**
   * Construct a component
   *
   * @param      {string}  [address]  The address
   * @param      {string}  [path]     The path
   */
  constructor (address, path) {
    this._id = crypto.randomBytes(32).toString('hex')
    this._address = address || ('id://' + this._id)
    this._path = path
    this._meta = {}

    if (_host) _host.register(this)
  }

  static get host () {
    return _host
  }

  static set host (component) {
    _host = component
  }

  /**
   * Get the type of this component
   *
   * @return     {string}  A string e.g. `"document"`, `"sheet"`
   */
  get type () {
    return this.constructor.name.toLowerCase()
  }

  get id () {
    return this._id
  }

  get address () {
    return this._address
  }

  lengthen (address) {
    address = address || this.address

    if (address.match(/^[a-z]+:\/\//)) {
      return address
    } else if (address[0] === '+') {
      return 'new://' + address.substring(1)
    } else if (address[0] === '~') {
      return 'id://' + address.substring(1)
    } else if (address[0] === '.' || address[0] === '/') {
      return 'file://' + path.resolve(address)
    } else if (address.substring(0, 3) === 'bb/') {
      return 'git://bitbucket.org/' + address.substring(3)
    } else if (address.substring(0, 3) === 'gh/') {
      return 'git://github.com/' + address.substring(3)
    } else if (address.substring(0, 3) === 'gl/') {
      return 'git://gitlab.com/' + address.substring(3)
    } else {
      return 'git://stenci.la/' + address
    }
  }

  shorten (address) {
    address = address || this.address

    if (address.substring(0, 6) === 'new://') {
      return '+' + address.substring(6)
    } else if (address.substring(0, 5) === 'id://') {
      return '~' + address.substring(5)
    } else if (address.substring(0, 7) === 'file://') {
      return address.substring(7)
    } else if (address.substring(0, 7) === 'http://' || address.substring(0, 8) === 'https://') {
      return address
    } else if (address.substring(0, 20) === 'git://bitbucket.org/') {
      return 'bb/' + address.substring(20)
    } else if (address.substring(0, 17) === 'git://github.com/') {
      return 'gh/' + address.substring(17)
    } else if (address.substring(0, 17) === 'git://gitlab.com/') {
      return 'gl/' + address.substring(17)
    } else if (address.substring(0, 16) === 'git://stenci.la/') {
      return address.substring(16)
    } else {
      throw Error('Unable to shortern address\n address: ' + address)
    }
  }

  split (address) {
    address = address || this.address

    address = this.lengthen(address)
    let matches = address.match(/([a-z]+):\/\/([\w\-\./]+)(@([\w\-\.]+))?/)
    if (matches) {
      return {
        scheme: matches[1],
        path: matches[2],
        format: path.extname(matches[2]).substring(1) || null,
        version: matches[4] || null
      }
    } else {
      throw Error('Unable to split address\n address: ' + address)
    }
  }

  /**
   * Get the converter for a format
   *
   * @param      {string} format  The format e.g. `'html'`, `'md'`
   * @return     {ComponentConverter}  A component converter
   */
  converter (format) {
    if (format === 'data') {
      return new ComponentDataConverter()
    } else if (format === 'json') {
      return new ComponentJsonConverter()
    } else if (format === 'html') {
      return new ComponentHtmlConverter()
    } else if (format === 'html-head') {
      return new ComponentHtmlHeadConverter()
    } else if (format === 'html-body') {
      return new ComponentHtmlBodyConverter()
    } else {
      throw Error('Unhandled format\n  format: ' + format)
    }
  }

  load (content, format, options) {
    this.converter(format).load(this, content, format, options)
    return this
  }

  dump (format, options) {
    return this.converter(format).dump(this, format, options)
  }

  get json () {
    return this.dump('json')
  }

  set json (content) {
    return this.load(content, 'json')
  }

  get html () {
    return this.dump('html')
  }

  set html (content) {
    return this.load(content, 'html')
  }

  get path () {
    return this._path
  }

  read (filepath, options) {
    if (!filepath || filepath === '') {
      filepath = this._path
    }

    try {
      fs.statSync(filepath)
    } catch (err) {
      throw new Error(`Local file system path does not exist\n  path: ${filepath}`)
    }

    let format = path.extname(filepath).substring(1)
    this.converter(format).read(this, filepath, format, options)

    this._path = filepath

    return this
  }

  write (filepath, options) {
    if (!filepath || filepath === '') {
      filepath = this._path
    }

    mkdirp.sync(path.extname(filepath) === '' ? filepath : path.dirname(filepath))

    let format = path.extname(filepath).substring(1)
    this.converter(format).write(this, filepath, format, options)

    this._path = filepath

    return this
  }

  save (content, format, filepath, options) {
    return this.load(content, format, options)
               .write(filepath, options)
  }

  get title () {
    return this._meta.title
  }

  set title (value) {
    this._meta.title = value
  }

  get description () {
    return this._meta.description
  }

  set description (value) {
    this._meta.description = value
  }

  get summary () {
    return this._meta.summary
  }

  set summary (value) {
    this._meta.summary = value
  }

  get keywords () {
    return this._meta.keywords
  }

  set keywords (value) {
    this._meta.keywords = value
  }

  get authors () {
    return this._meta.authors
  }

  set authors (value) {
    this._meta.authors = value
  }

  get date () {
    return this._meta.date
  }

  set date (value) {
    this._meta.date = value
  }

  get url () {
    return _host.url + '/' + this.shorten()
  }

  show (format) {
    format = format || 'html'

    if (format === 'json') {
      return this.dump('json')
    } else {
      return `<!DOCTYPE html>
<html>
  <head>
    ${this.dump('html-head')}
    <meta name="generator" content="stencila-js-${version}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="/web/${this.type}.min.css">
  </head>
  <body>
    ${this.dump('html-body')}
    <script src="/web/${this.type}.min.js"></script>
  </body>
</html>`
    }
  }

  view () {
    _host.serve()
    if (os.platform() === 'linux') {
      child.exec('2>/dev/null 1>&2 xdg-open "' + this.url + '"')
    } else {
      child.exec('open "' + this.url + '"')
    }
  }

}

module.exports = Component
