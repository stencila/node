const child = require('child-process-promise')
const crypto = require('crypto')
const fs = require('fs')
const os = require('os')
const path = require('path')
const pathm = path
const mkdirp = require('mkdirp')

const moniker = require('moniker')
const names = moniker.generator([moniker.adjective])

const version = require('../../package').version
const ComponentDataConverter = require('./ComponentDataConverter')
const ComponentJsonConverter = require('./ComponentJsonConverter')
const ComponentHtmlConverter = require('./ComponentHtmlConverter')
const ComponentHtmlHeadConverter = require('./ComponentHtmlHeadConverter')
const ComponentHtmlBodyConverter = require('./ComponentHtmlBodyConverter')

// Variable that holds the static member `host` of the `Component` class
// See `Component.host` below
var _host = null

// Stencila home directory path
var home = path.join(os.homedir(), '.stencila')

/**
 * The abstract base class for all Stencila components
 *
 * @class Component
 */
class Component {

  /**
   * Construct this component
   *
   * @param      {string}  [address]  The address
   * @param      {string}  [path_]     The path
   */
  constructor (address, path_) {
    this._id = crypto.randomBytes(32).toString('hex')

    if (address) this._address = this.long(address)
    else this._address = 'name://' + names.choose() + '-' + this.type

    if (path) this._path = path_
    else this._path = null

    this._meta = {}

    if (_host) _host.register(this)
  }

  /**
   * Get the host
   *
   * Using a static getter for this purpose is useful
   * for avoid ng circular dependencies
   *
   * @return {Host} The host
   */
  static get host () {
    return _host
  }

  /**
   * Set the host
   *
   * This method should only be called once, by the `Host`
   * instance, on construction
   *
   * @param {Host} host The host
   */
  static set host (host) {
    _host = host
  }

  /**
   * Get the type of this component
   *
   * @return {string} A string e.g. `"document"`, `"sheet"`
   */
  get type () {
    return this.constructor.name.toLowerCase()
  }

  /**
   * Get the kind of this component
   *
   * Used to specify the user interface to be loaded for this component.
   * Usually the a component's `kind` is the same as it's `type` (e.g. `document` and `document`)
   * But for sessions type may be `js-session` or `r-session` but kind is always `session`.
   *
   * @return {string} A string e.g. `"session"`
   */
  get kind () {
    return this.type
  }

  /**
   * Get the defaults for this type of component
   */
  static get defaults () {
    return {
      extension: 'html'
    }
  }

  /**
   * Get the id of this component
   *
   * Each component has a unique identifier. This is used as a
   * default address when peers or browser clients want to
   * access the component.
   *
   * @return {string} The id
   */
  get id () {
    return this._id
  }

  /**
   * Get the address of this component
   *
   * @return {string} The address
   */
  get address () {
    return this._address
  }

  /**
   * Get the long form of an address
   *
   * If the `address` parameter is not supplied then returns the
   * long form address of *this* component.
   *
   * @see Component#short
   * @see address
   *
   * @example
   *
   * component.long('+document')
   * 'new://document'
   *
   * component.long('gh:stencila/stencila')
   * 'gh://stencila/stencila'
   *
   * component.long('./report/intro.md')
   * 'file:///current/directory/report/intro.md'
   *
   * component.long('stats/t-test')
   * 'st://stats/t-test'
   *
   * component.long()
   * 'id://fa4cf2c5cff5b576990feb96f25c98e6111990c873010855a53bcba979583836'
   *
   * @param  {String|null} [address] The address to lengthen
   * @return {String}                The long form of the address
   */
  long (address) {
    address = address || this.address

    if (address.match(/^(new|id|name|file|http|https|git|dat|st):\/\//)) {
      return address
    } else if (address[0] === '+') {
      return 'new://' + address.substring(1)
    } else if (address[0] === '*') {
      return 'name://' + address.substring(1)
    } else if (address[0] === '.' || address[0] === '/' || address[0] === '~') {
      if (address[0] === '~') address = os.homedir() + address.substring(1)
      return 'file://' + path.resolve(address)
    } else {
      let match = address.match(/^([a-z]+)(:\/?\/?)(.+)$/)
      if (match) {
        let alias = match[1]
        let path = match[3]
        if (alias === 'bb') {
          return `git://bitbucket.org/${path}`
        } else if (alias === 'dat') {
          return `dat://${path}`
        } else if (alias === 'file') {
          // Only arrive here with `file:/foo` since with
          // `file:` with two or more slashes is already "long"
          return `file:///${path}`
        } else if (alias === 'http' || alias === 'https') {
          return `${alias}://${path}`
        } else if (alias === 'gh') {
          return `git://github.com/${path}`
        } else if (alias === 'gl') {
          return `git://gitlab.com/${path}`
        } else {
          throw new Error(`Unknown scheme alias.\n  alias: ${alias}`)
        }
      } else {
        return 'st://' + address
      }
    }
  }

  /**
   * Get the short form of an address
   *
   * This method is the inverse of `long()`. It shortens an address tp
   * a smaller, more aeshetically pleasing form, that is useful in URLs
   * an other places.
   *
   * If the `address` parameter is not supplied then returns the
   * short form address of this component.
   *
   * @see Component#long
   *
   * @example
   *
   * component.short('new://document')
   * '+document'
   *
   * component.short('file:///some/directory/my-doc.md')
   * 'file:/some/directory/my-doc.md'
   *
   * component.short()
   * '*fa4cf2c5cff5b576990feb96f25c98e6111990c873010855a53bcba979583836'
   *
   * @param  {String} [address] The address to shorten
   * @return {String}           The short form of the address
   */
  short (address) {
    address = address || this.address

    address = this.long(address)
    if (address.substring(0, 6) === 'new://') {
      return '+' + address.substring(6)
    } else if (address.substring(0, 7) === 'name://') {
      return '*' + address.substring(7)
    } else if (address.substring(0, 7) === 'file://') {
      return 'file:' + address.substring(7)
    } else if (address.substring(0, 5) === 'st://') {
      return address.substring(5)
    } else if (address.substring(0, 20) === 'git://bitbucket.org/') {
      return 'bb:' + address.substring(20)
    } else if (address.substring(0, 17) === 'git://github.com/') {
      return 'gh:' + address.substring(17)
    } else if (address.substring(0, 17) === 'git://gitlab.com/') {
      return 'gl:' + address.substring(17)
    } else {
      let match = address.match(/([a-z]+):\/\/(.+)$/)
      return `${match[1]}:${match[2]}`
    }
  }

  split (address) {
    address = address || this.address

    address = this.long(address)
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
  static converter (format) {
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
    this.constructor.converter(format).load(this, content, format, options)
    return this
  }

  dump (format, options) {
    return this.constructor.converter(format).dump(this, format, options)
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
    this.constructor.converter(format).read(this, filepath, format, options)

    this._path = filepath

    return this
  }

  /**
   * Write this component to the local filesystem
   *
   * If `path` is provided the component's `path` will be updated. Otherwise, this component's
   * existing `path` property will be used.
   *
   * The actual writing to file is done by a converter determined from the format (i.e. filename extension)
   * of the `path`. If the `path` does not have an extension then the default extension for the component
   * class will be used.
   *
   * @param  {String} path [description]
   * @param  {String} options  [description]
   * @return {Component} This component
   */
  write (path, options) {
    if (!path || path === '') {
      path = this._path
    }

    let format = pathm.extname(path).substring(1)
    if (format === '') {
      if (this.constructor.defaults.extension) {
        format = this.constructor.defaults.extension
        path = path + '.' + format
      }
    }

    mkdirp.sync(pathm.extname(path) === '' ? path : pathm.dirname(path))

    this.constructor.converter(format).write(this, path, format, options)

    this._path = path

    return this
  }

  /**
   * Save this component
   *
   * The component will `load()` itself from the `content` (using the
   * `format` specified) and then `write()` itself to the `path`. Note that the format
   * of the content provided (determined by the `format` parameter) is not necessarily
   * the same as the format written to disk (determined by the filename extension of this component's `path`)
   *
   * @param  {String} content  [description]
   * @param  {String} format   [description]
   * @param  {String} [path] [description]
   * @param  {Object} options  [description]
   * @return {Component} This component
   */
  save (content, format, path, options) {
    return this.load(content, format, options)
               .write(path, options)
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
    return _host.url + '/' + this.short()
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
    <meta name="generator" content="stencila-node-${version}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="/web/${this.kind}.min.css">
  </head>
  <body>
    ${this.dump('html-body')}
    <script src="/web/${this.kind}.min.js"></script>
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
