const child = require('child-process-promise')
const os = require('os')

const version = require('../../package').version
const HostHttpServer = require('./HostHttpServer')

const NodeContext = require('../node-context/NodeContext')

const TYPES = {
  'NodeContext': NodeContext
}

/**
 * A `Host` allows you to create, get, run methods of, and delete instances of various types.
 * The types can be thought of a "services" provides by the host e.g. `NoteContext`, `FilesystemStorer`
 *
 * The API of a host is similar to that of a HTTP server. It's methods names
 * (e.g. `post`, `get`) are similar to HTTP methods (e.g. `POST`, `GET`) but
 * the sematics sometimes differ (e.g. a host's `put()` method is used to call an 
 * instance method)
 * 
 * A `Host` is not limited to beng served by HTTP and it's methods are exposed by both `HostHttpServer`
 * and `HostWebsocketServer`. Those other classes are responsible for tasks associated with
 * their communication protocol (e.g. serialising and deserialising objects).
 *
 * 
 * This is a singleton class. There should only ever be one `Host`
 * in memory in each process (although, for purposes of testing, this is not enforced)
 */
class Host {

  constructor () {
    this._servers = {}
    this._instances = {}
  }

  /**
   * Get a manifest for this host
   *
   * The manifest describes the host and it's capabilities. It is used
   * by peer hosts to determine which "types" this host provides and
   * which "instances" have already been instantiated.
   *   
   * @return {Promise} Resolves to a manifest object
   */
  options () {
    return Promise.resolve({
      stencila: {
        package: 'node',
        version: version
      },
      urls: Object.keys(this._servers).map(key => this._servers[key].url()),
      types: Object.keys(TYPES),
      instances: Object.keys(this._instances)
    })
  }

  /**
   * Create a new instance of a type
   * 
   * @param  {string} type - Type of instance
   * @param  {object} options - Options to be passed to type constructor
   * @return {Promise} - Resolves to the ID string of newly created instance
   */
  post (type, options) {
    return new Promise((resolve, reject) => {
      let Class = TYPES[type]
      if (Class) {
        let instance = new Class(options)
        let id = Math.floor((1 + Math.random()) * 1e6).toString(16)
        this._instances[id] = instance
        resolve(id)
      } else {
        reject(new Error(`Unknown type: ${type}`))
      }
    })
  }

  /**
   * Get an instance
   * 
   * @param  {string} id - ID of instance
   * @return {Promise} - Resolves to the instance
   */
  get (id) {
    return new Promise((resolve, reject) => {
      let instance = this._instances[id]
      if (instance) {
        resolve(instance)
      } else {
        reject(new Error(`Unknown instance: ${id}`))
      }
    })
  }

  /**
   * Call a method of an instance
   * 
   * @param  {string} id - ID of instance
   * @param {string} method - Name of instance method
   * @param {array} args - An array of method arguments
   * @return {Promise} Resolves to result of method call
   */
  put (id, method, args) {
    args = args || []
    return new Promise((resolve, reject) => {
      let instance = this._instances[id]
      if (instance) {
        let func = instance[method]
        if (func) {
          resolve(Promise.resolve(instance[method](...args)))
        } else {
          reject(new Error(`Unknown method: ${method}`))
        }
      } else {
        reject(new Error(`Unknown instance: ${id}`))
      }
    })
  }

  /**
   * Delete an instance
   * 
   * @param  {string} id - ID of the instance
   * @return {Promise}
   */
  delete (id) {
    return new Promise((resolve, reject) => {
      let instance = this._instances[id]
      if (instance) {
        delete this._instances[id]
        resolve()
      } else {
        reject(new Error(`Unknown instance: ${id}`))
      }
    })
  }

  /**
   * Start serving this host
   *
   * Currently, HTTP is the only server available
   * for hosts. We plan to implement a `HostWebsocketServer` soon. 
   * 
   * @return {Promise}
   */
  start () {
    return new Promise((resolve) => {
      if (!this._servers.http) {
        var server = new HostHttpServer(this)
        this._servers.http = server
        server.start().then(resolve)
      }
      resolve()
    })
  }

  /**
   * Stop serving this host
   * 
   * @return {Promise}
   */
  stop () {
    return new Promise((resolve) => {
      const type = 'http'
      let server = this._servers[type]
      if (server) {
        delete this._servers[type]
        server.stop().then(resolve)
      }
    })
  }

  /**
   * Get a list of server names for this host
   *
   * Servers are identified by the protocol shorthand
   * e.g. `http` for `HostHttpServer`
   * 
   * @return {array} Array of strings
   */
  get servers () {
    return Object.keys(this._servers)
  }

  /**
   * View this host in the browser
   *
   * Opens the default browser at the URL of this host
   */
  view () {
    /* istanbul ignore next */
    Promise.resolve(
      this.start()
        .then(() => {
          let url = this._servers.http.url()
          if (os.platform() === 'linux') {
            child.exec(`2>/dev/null 1>&2 xdg-open "${url}"`)
          } else {
            child.exec(`open "${url}"`)
          }
        })
    )
  }

}

module.exports = Host
