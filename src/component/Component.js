const child = require('child-process-promise')
const crypto = require('crypto')
const fs = require('fs')
const he = require('he')
const os = require('os')
const path = require('path')
const pathm = path
const mkdirp = require('mkdirp')

const moniker = require('moniker')
const names = moniker.generator([moniker.adjective])
const tmp = require('tmp')

const version = require('../../package').version
const ComponentDelegate = require('./ComponentDelegate')
const ComponentDataConverter = require('./ComponentDataConverter')
const ComponentJsonConverter = require('./ComponentJsonConverter')
const ComponentHtmlConverter = require('./ComponentHtmlConverter')

// Variable that holds the static member `host` of the `Component` class
// See `Component.host` below
var _host = null

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

    this._delegate = null

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
   * Get the type of this component class
   *
   * @return {string} A string e.g. `"document"`, `"sheet"`
   */
  static get type () {
    return this.name.toLowerCase()
  }

  /**
   * Get the type of this component instance
   *
   * @return {string} A string e.g. `"document"`, `"sheet"`
   */
  get type () {
    return this.constructor.type
  }

  /**
   * Get the kind of this component class
   *
   * Used to specify the user interface to be loaded for this component.
   * Usually the a component's `kind` is the same as it's `type` (e.g. `document` and `document`)
   * But for sessions type may be `js-session` or `r-session` but kind is always `session`.
   *
   * @return {string} A string e.g. `"session"`
   */
  static get kind () {
    return this.type
  }

  /**
   * Get the kind of this component instance
   *
   * @return {string} A string e.g. `"document"`, `"session"`
   */
  get kind () {
    return this.constructor.kind
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
    let matches = address.match(/([a-z]+):\/\/([\w\-\./]+)(@([\w\-\.]+))?/) // eslint-disable-line no-useless-escape
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

  set delegate (url) {
    this._delegate = new ComponentDelegate(url)
  }

  get delegate () {
    if (this._delegate) {
      return this._delegate
    } else {
      throw new Error('This component does not have a delegate')
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

  read (filepath, format, options) {
    if (!filepath || filepath === '') {
      filepath = this._path
    }

    try {
      fs.statSync(filepath)
    } catch (err) {
      throw new Error(`Local file system path does not exist\n  path: ${filepath}`)
    }

    format = format || path.extname(filepath).substring(1)
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
   * @param  {String} format  [description]
   * @param  {String} options  [description]
   * @return {Component} This component
   */
  write (path, format, options) {
    if (!path || path === '') {
      if (!this._path) {
        this._path = tmp.tmpNameSync()
      }
      path = this._path
    }

    format = format || pathm.extname(path).substring(1)
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

  /**
   * "Show" this component
   *
   * Used to respond to a HTML GET request for this component with
   * content based on the requested content (JSON or a HTML page)
   *
   * @param  {String} format Format of conteent (defaults to `html`)
   * @return {String}        JSON or HTML content
   */
  show (format) {
    return (format || 'html') === 'json' ? this.dump('json') : this.page()
  }

  /**
   * Generate a HTML page for this component
   *
   * The generated page has the structure expected by the user interfaces implemented
   * in the Stencila `web` package. CSS and JS from that package can be served lacally or from
   * a CDN.
   *
   * Note that this is a recursive function and the `part` arguments is primarily
   * used as a way for derived classes to override parts of the page.
   *
   * @param {String} options Options.
   * @param {String} part Part of page to generate (e.g. 'meta', 'main')
   * @return {String} HTML page (or part of)
   */
  page (options, part) {
    options = options || {}
    options.headExtra = options.headExtra || ''
    options.header = options.header || ''
    options.footer = options.footer || ''

    // During development you can serve JS and CSS for UI from local using the
    // the env var `STENCILA_WEB`. If not set then falls back to the CDN
    // See `HostHttpServer#web` for more details.
    let web = process.env.STENCILA_WEB
    if (typeof web === 'undefined') {
      web = 'https://unpkg.com/stencila-web/build'
    } else if (web.match(/\d+/)) {
      // Being served by a local development server
      web = `http://127.0.0.1:${web}/web`
    } else {
      // Being served from the filesystem
      // See `HostHttpServer#web`
      web = '/web'
    }

    if (part === 'head') {
      return `<title>${this.title || this.address}</title>\n` +
          `<meta name="id" content="${this.id}">\n` +
          (this.address ? `<meta name="address" content="${this.address}">\n` : '') +
          (this.url ? `<meta name="url" content="${this.url}">\n` : '') +
          (this.description ? `<meta name="description" content="${this.description}">\n` : '') +
          (this.keywords ? `<meta name="keywords" content="${this.keywords.join(', ')}">\n` : '') +
          (options.static ? `<meta name="static" content="${options.static}">\n` : '') +
          (options.naked ? `<meta name="naked" content="${options.naked}">\n` : '') +
          (options.edit ? `<meta name="edit" content="${options.edit}">\n` : '') +
          `<meta name="generator" content="stencila-node-${version}">` +
          '<meta name="viewport" content="width=device-width, initial-scale=1">'
    } else if (part === 'main') {
      let data = this.dump('data')
      let json = he.encode(JSON.stringify(data))
      return `<script id="data" data-format="json" type="application/json">${json}</script>`
    } else {
      return `<!DOCTYPE html>
      <html>
        <head>
          ${this.page(options, 'head')}
          <link rel="stylesheet" type="text/css" href="${web}/${this.kind}.min.css">
          ${options.headExtra}
        </head>
        <body>
          <header>
            ${options.header}
          </header>
          <main>
            ${this.page(options, 'main')}
          </main>
          <footer>
            ${options.footer}
          </footer>
          <script src="${web}/${this.kind}.min.js"></script>
        </body>
      </html>`
    }
  }

  /**
   * View this component in the browser
   *
   * Ensures that the `host` is serving and then opens the default browser
   * at the local URL for this component
   */
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
