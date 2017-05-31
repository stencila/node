const child = require('child-process-promise')
const crypto = require('crypto')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const os = require('os')

const version = require('../../package').version
const HostHttpServer = require('./HostHttpServer')

const NodeContext = require('../node-context/NodeContext')

// Look up for classes available under the 
// `new` sheme
const NEW = {
  'NodeContext': NodeContext
}

/**
 * A `Host` allows you to create, get, run methods of, and delete instances of various types.
 * The types can be thought of a "services" provided by the host e.g. `NoteContext`, `FilesystemStorer`
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
    this._id = `node-${crypto.randomBytes(24).toString('hex')}`
    this._servers = {}
    this._instances = {}
    this._started = null;
    this._heartbeat = null;
  }

  /**
   * Get unique ID of this host
   */
  get id () {
    return this._id
  }

  /**
   * Get the current user's Stencila data directory
   */
  userDir () {
    switch(process.platform) {
      case 'darwin':
        return path.join(process.env.HOME, 'Library', 'Preferences', 'Stencila')
      case 'linux':
        return path.join(process.env.HOME, '.local', 'share', 'stencila')
      case 'windows':
        return path.join(process.env.APPDATA, 'Stencila')
      default:
        return path.join(process.env.HOME, 'stencila')
    }
  }

  /**
   * Get the current Stencila temporary directory
   */
  tempDir () {
    switch(process.platform) {
      case 'linux':
        return path.join(os.tmpdir(), 'stencila')
      default:
        return path.join(os.tmpdir(), 'Stencila')
    }
  }

  /**
   * Get the environment of this host including the version of Node.js and versions
   * of installed packages (local and globals)
   * 
   * @return {Object} The environment as a object
   */
  environ () {
    // TODO package names and versions
    // See for example https://github.com/stencila/r/blob/8575f43096b6472fcc039e513a5f82a274864241/R/host.R#L91
    return {
      version: process.version,
      platform: process.platform,
      arch: process.arch,
      packages: {}
    }
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
  manifest (complete=true) {
    let new_ = {}
    for (let name of Object.keys(NEW)) {
      new_[name] = NEW[name].spec
    }
    let manifest = {
      stencila: {
        package: 'node',
        version: version
      },
      run: [process.execPath, '-e', "require('stencila-node').run()"],
      schemes: {
        new: new_
      }
    }
    if (complete) {
      manifest = Object.assign(manifest, {
        id: this.id,
        urls: this.urls,
        instances: Object.keys(this._instances),
        environ: this.environ()
      })
    }
    return manifest
  }

  /**
   * Install this Stencila Host on this machine.
   *
   * Installation of a host involves creating a file `node.json` inside of
   * the user's Stencila data (see `userDir()`) directory which describes
   * the capabilities of this host.
   */
  install () {
    let dir = path.join(this.userDir(), 'hosts')
    mkdirp(dir, error => {
      if (error) throw error
      fs.writeFile(path.join(dir, 'node.json'), JSON.stringify(this.manifest(false), null, '  '), error => {
        if (error) throw error
      })
    })
  }

  /**
   * Create a new instance of a type
   * 
   * @param  {string} address - Type of instance
   * @param  {object} options - Options to be passed to type constructor
   * @return {Promise} - Resolves to the ID string of newly created instance
   */
  post (type, name, options) {
    return new Promise((resolve, reject) => {
      let Class = NEW[type]
      if (Class) {
        let address = `name://${name || Math.floor((1 + Math.random()) * 1e6).toString(16)}`
        this._instances[address] = new Class(options)
        resolve(address)
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
      let instance = id ? this._instances[id] : this
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
  start (address='127.0.0.1', port=2000) {
    return new Promise((resolve) => {
      if (!this._servers.http) {
        // Start HTTP server
        var server = new HostHttpServer(this, address, port)
        this._servers.http = server
        server.start().then(() => {
          // Record start time
          this._started = new Date()
          // Register as a running host by creating a run file
          let file = path.join(this.tempDir(), 'hosts', this.id + '.json')
          mkdirp(path.dirname(file), error => {
            if (error) throw error
            fs.writeFile(file, JSON.stringify(this.manifest(), null, '  '), { mode: '600' }, error => {
              if (error) throw error
            })
          })
          console.log('Host has started at: ' + this.urls.join(', ')) // eslint-disable-line no-console
          resolve()
        })
      }
      resolve()
    })
  }

  heartbeat () {
    this._heartbeat = new Date()
    return this._heartbeat
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
        server.stop().then(() => {
          // Deregister as a running host by removing run file
          let file = path.join(this.tempDir(), 'hosts', this.id + '.json')
          fs.unlink(file)
          console.log('Host has stopped.') // eslint-disable-line no-console
          resolve()
        })
      }
    })
  }

  /**
   * Start serving this host and wait for connections
   * indefinitely
   * 
   * @return {Promise}
   */
  run (address='127.0.0.1', port=2000, timeout=Infinity, duration=Infinity) {
    const stop = () => {
      this.stop().then(() => {
        process.exit()
      })
    }

    // Setup timer to check timeout and duration every minute
    setInterval(()=>{
      const time = new Date()
      if ((time - this._heartbeat)/1000 > timeout || (time - this._started)/1000 >= duration) {
        stop();
      }
    }, 60 * 1000)    

    // Handle interrupt
    if (process.platform === "win32") {
      var rl = require("readline").createInterface({
        input: process.stdin,
        output: process.stdout
      })
      rl.on("SIGINT", () => process.emit("SIGINT"))
    }
    process.on("SIGINT", stop)

    return this.start(address, port)
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
   * Get a list of URLs for this host
   * 
   * @return {array} Array of strings
   */
  get urls () {
    return Object.values(this._servers).map(server => server.url)
  }

  /**
   * View this host in the browser
   *
   * Opens the default browser at the URL of this host
   */
  view () {
    // Difficult to test headlessly, so don't include in coverage
    /* istanbul ignore next */
    Promise.resolve(
      this.start()
        .then(() => {
          let url = this._servers.http.url
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
