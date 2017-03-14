const version = require('../../package').version
const NodeContext = require('../node-context/NodeContext')
const HostHttpServer = require('./HostHttpServer')

/**
 * A `Host` orchestrates `Components` and encapsulates application state.
 * This is a singleton class - there should only ever be one `Host`
 * in memory in each process (although, for purposes of testing, this is not enforced)
 *
 * @class      Host
 */
class Host {

  constructor () {
    this._components = []
    this._servers = {}

    // Currently, this is unused
    this._peers = []
  }

  get services () {
    return {
      'NodeContext.new': (...args) => this.new(NodeContext, ...args)
    }
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
   * - `services`: a list of services this host can provide
   *
   * @return     {Object} A manifest
   */
  get manifest () {
    return {
      stencila: true,
      package: 'node',
      version: version,
      id: this.id,
      url: this.url,
      services: Object.keys(this.services)
    }
  }

  /**
   * Get a list of components managed by this host
   *
   * @return     {Array<Component>}  Array of components registered with this host
   */
  get components () {
    return this._components
  }

  new (Class) {
    this
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
   * @return {Host} This host
   */
  register (component) {
    this._components.push(component)
    return this
  }

  /**
   * Deregister a component with this host
   *
   * @param  {[type]} component [description]
   * @return {Host} This host
   */
  deregister (component) {
    let index = this._components.indexOf(component)
    if (index > -1) {
      this._components.splice(index, 1)
    }
    return this
  }

  /**
   * Retrive a component that has already been instantiated and registered.
   *
   * Searches for a component with a matching address in `this.components`
   *
   * @see  register, create, load, clone, open
   *
   * @param  {string} address Component address to search for
   * @return {Component|null} The component, or `null` if not found
   */
  retrieve (address) {
    address = this.long(address)
    let {scheme, path} = this.split(address)
    for (let index in this._components) {
      let component = this._components[index]
      if (scheme === 'id') {
        if (component.id === path) return component
      } else {
        if (component.address === address) return component
      }
    }
    return null
  }

  serve (on) {
    if (typeof on === 'undefined') on = true
    if (on) {
      if (!this._servers.http) {
        var server = new HostHttpServer(this)
        this._servers.http = server
        return server.serve().then(() => {
          this._address = `name://local-${this._servers.http.port}-${this.type}`
        })
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

}

module.exports = Host
