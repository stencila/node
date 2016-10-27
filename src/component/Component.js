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

// Variable that holds the static member `host` of the `Component` class
// See `Component.host` below
var _host = null

var home = path.join(os.homedir(), '.stencila')

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
   * @param      {string}  [path_]     The path
   */
  constructor (address, path_) {
    this._id = crypto.randomBytes(32).toString('hex')
    if (address) address = this.long(address)
    else address = 'id://' + this._id
    this._address = address
    this._path = path_ || path.join(home, 'id', this._id)
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

    if (address.match(/^(new|id|file|http|https|git|dat|st):\/\//)) {
      return address
    } else if (address[0] === '+') {
      return 'new://' + address.substring(1)
    } else if (address[0] === '*') {
      return 'id://' + address.substring(1)
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
        } else if (alias === 'http' | alias === 'https') {
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
    } else if (address.substring(0, 5) === 'id://') {
      return '*' + address.substring(5)
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

  write (filepath, options) {
    if (!filepath || filepath === '') {
      filepath = this._path
    }

    mkdirp.sync(path.extname(filepath) === '' ? filepath : path.dirname(filepath))

    let format = path.extname(filepath).substring(1)
    this.constructor.converter(format).write(this, filepath, format, options)

    this._path = filepath

    return this
  }

  save (content, format, filepath, options) {
    if (!filepath || filepath === '') {
      filepath = this._path
    }
    // Ensure that the file name has the correct exension
    let bits = path.parse(filepath)
    if (bits.ext !== format) {
      filepath = path.join(bits.dir, bits.name + '.' + format)
    }
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
