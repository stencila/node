const fs = require('fs')
const request = require('request-promise')

const version = require('../../package').version
const Component = require('../component/Component')
const Document = require('../document/Document')
const RemoteDocument = require('../document/RemoteDocument')
const Sheet = require('../sheet/Sheet')
const JsSession = require('../js-session/JsSession')
const HttpServer = require('../servers/HttpServer')
const HostDataConverter = require('./HostDataConverter')

/**
 * A `Host` is ....
 *
 * @class      Host
 */
class Host extends Component {

  constructor () {
    super()

    if (!Component.host) {
      Component.host = this
    }

    this._components = []

    this._servers = {}

    this._peers = []
  }

  /**
   * Get the `Host` converter for a format
   *
   * @override
   * @param {string} format Format for conversion
   * @return {ComponentConverter} A converter object
   */
  converter (format) {
    if (format === 'data') {
      return new HostDataConverter()
    } else {
      return super.converter(format)
    }
  }

  get title () {
    return 'Stencila Javascript Host'
  }

  /**
   * Get a list of components managed by this host
   *
   * @return     {Array<Component>}  Array of components registered with this host
   */
  get components () {
    return this._components
  }

  /**
   * Register a component with this host
   *
   * This method is called by the `constructor()` method of
   * the `Component` class so that each component is registered when
   * it is constructed. It's unlikely to be used in any other context.
   *
   * @todo        Check that the component has not yet been registered
   *
   * @param      {Component}  component  The component
   * @return     {Host} This host
   */
  register (component) {
    this._components.push(component)
    return this
  }

  /**
   * Open a `Component` at an address
   *
   * @example
   * // Create a new document
   * host.open('+document')
   *
   * @example
   * host.open('stats/t-test')
   *
   * @param      {string}                             address  The address
   * @return     {Component}  { description_of_the_return_value }
   */
  open (address) {
    if (address === null) return this

    address = this.lengthen(address)
    let {scheme, path, format, version} = this.split(address) // eslint-disable-line no-unused-vars

    if (scheme === 'new') {
      if (path === 'document') return new Document()
      else if (path === 'sheet') return new Sheet()
      else if (path === 'js-session') return new JsSession()
    }

    for (let index in this._components) {
      let component = this._components[index]
      if (scheme === 'id') {
        if (component.id === path) return component
      } else {
        if (component.address === scheme + '://' + path) return component
      }
    }

    let filename = this.clone(address)
    for (let cls of [Document, Sheet]) {
      let component = cls.open(address, filename)
      if (component) return component
    }

    // this.ask(address).then(resolve)

    throw Error(`Unable to open address\n address: ${address}`)
  }

  clone (address) {
    let {scheme, path, format, version} = this.split(address) // eslint-disable-line no-unused-vars

    if (scheme === 'file') {
      try {
        fs.statSync(path)
        return path
      } catch (error) {
        throw Error(`Local file system path does not exist\n  path: ${path}`)
      }
    }

    throw Error(`Unable to clone address\n address: ${address}`)
  }

  /**
   * A list of peers
   *
   * See Host#discover for how this list is populated
   *
   * @readonly
   */
  get peers () {
    return this._peers
  }

  /**
   * Get a manifest for this host
   *
   * A manifest describes this host and it's capabilities. When a host
   * says `hello` to a peer, they exchange manifests. The manifest is an object
   * with the following properties:
   *
   * - `stencila`: a `true` value that simply indicates to a peer that this is a Stencila host
   * - `package`: the name of the Stencila package
   * - `version`: the version of the Stencila package
   * - `id`: the id of this host
   * - `url`: the URL of this host
   * - `schemes`: a list of schemes e.g. `git` that this host can handle
   * - `types`: a list of types of components this host can create
   * - `formats`: a list of formats e.g. `md` that this host recognises
   *
   * @return     {Object} A manifest
   */
  manifest () {
    return {
      stencila: true,
      package: 'js',
      version: version,
      id: this.id,
      url: this.url,
      schemes: [
        'new', 'id', 'file'
      ],
      types: [
        'document', 'sheet', 'js-session'
      ],
      formats: [
        'html', 'md'
      ]
    }
  }

  /**
   * Say "hello" to a peer
   *
   * When a host attempts to `discover()` peers it does a HTTP `POST` request to
   * the `/!hello` endpoint. This method responds to that request by:
   *
   * 1. Recording the peer's manifest in this host's peer list (replacing or appending as appropriate)
   * 2. Providing the peer with this host's own manifest
   *
   * @param      {Object}    manifest  The peer's manifest
   * @return     {Object}    This host's manifest
   */
  hello (manifest) {
    let replaced = false
    for (let index in this._peers) {
      let peer = this._peers[index]
      if (peer.id === manifest.id) {
        this._peers[index] = manifest
        replaced = true
      }
    }
    if (!replaced) this._peers.push(manifest)
    return this.manifest()
  }

  /**
   * Discover peers on the local machine
   *
   * This method scans the ports 2000, 2010,...3000 on the 127.0.0.1 address
   * making a `POST /!hello` request with this host's manifest.
   * If another Stencila host is listening on the port then it will respond
   * with it's own manifest and will be added to this host's list of peers.
   *
   * @return {Host} This host
   */
  discover () {
    this._peers = []
    for (let port = 2000; port <= 3000; port += 10) {
      if (port !== this.servers.http.port) {
        request({
          method: 'POST',
          url: `http://127.0.0.1:${port}/!hello`,
          body: {
            manifest: this.manifest()
          },
          json: true,
          timeout: 100,
          resolveWithFullResponse: true
        })
        .then(function (response) {
          if (response.statusCode === 200) {
            let data = response.body
            if (data.stencila) {
              this._peers.push(data)
            }
          }
        }.bind(this))
        .catch(function (error) {
          if (error.name === 'RequestError') {
            if (error.code !== 'ECONNREFUSED' && error.code !== 'ETIMEDOUT') {
              return
            }
          }
          throw error
        })
      }
    }
    return this
  }

  /**
   * Ask peers to open a component
   *
   * If a host is unable to open a component address (e.g. because it does not
   * know the address scheme) it will ask it's peers. This method iterates over this
   * host's peers. If the scheme of the address is amongst the peer's schemes the peer
   * will be asked to open the address.
   *
   * @param {string} address The component addess to open
   * @return {Component|null} The component
   */
  ask (address) {
    return new Promise((resolve, reject) => {
      let {scheme, path, format, version} = this.split(address) // eslint-disable-line no-unused-vars
      let found = false
      for (let peer of this._peers) {
        if (
          (peer.schemes.indexOf(scheme) >= 0) && (
            (scheme === 'new' && peer.types.indexOf(path) >= 0) ||
            (peer.formats.indexOf(format) >= 0)
          )
        ) {
          request({
            url: peer.url + '/' + address,
            json: true,
            resolveWithFullResponse: true
          })
          .then(function (response) {
            if (response.statusCode === 200) {
              let data = response.body
              let type = data.type
              if (type === 'document') {
                resolve(new RemoteDocument(peer.url, data.id))
              } else {
                reject(new Error(`Unhandled component type\n  type: ${type}`))
              }
            }
          })
          .catch(function (error) {
            reject(error)
          })
          found = true
        }
      }
      if (!found) return reject(new Error(`No peers are able to open address\n  address: ${address}\n  scheme: ${scheme}\n  path: ${path}\n  format: ${format}`))
    })
  }

  serve (on) {
    if (on === undefined) on = true
    if (on) {
      if (!this._servers.http) {
        var server = new HttpServer(this)
        server.serve()
        this._servers.http = server
      }
    } else {
      for (let type in this._servers) {
        this._servers[type].serve(false)
        this._servers[type] = null
      }
    }
  }

  get servers () {
    return this._servers
  }

  get url () {
    return this._servers.http ? this._servers.http.url : null
  }

  /**
   * Start up this host (start servers and discover peers)
   *
   * @return {Host} This host
   */
  startup () {
    this.serve()
    this.discover()
    return this
  }

  /**
   * Shutdown this host (stop servers)
   *
   * @return {Host} This host
   */
  shutdown () {
    this.serve(false)
    return this
  }

}

module.exports = Host
