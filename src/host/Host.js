const crypto = require('crypto')
const execa = require('execa')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')
const os = require('os')
const stencila = require('stencila')

const version = require('../../package').version
const HostHttpServer = require('./HostHttpServer')
const { GET, POST, PUT } = require('../util/requests')

const DocumentBundle = require('../bundles/DocumentBundle')
const NodeContext = require('../node-context/NodeContext')

// Look up for classes available under the 
// `new` sheme
const TYPES = {
  'DocumentBundle': DocumentBundle,
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
    this._started = null
    this._heartbeat = null
    this._instances = {}
    this._peers = []
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
    return path.join(os.tmpdir(), 'stencila')
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
  manifest () {
    let new_ = {}
    for (let name of Object.keys(TYPES)) {
      new_[name] = TYPES[name].spec
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
    if (this._started) {
      manifest = Object.assign(manifest, {
        id: this.id,
        process: process.pid,
        urls: this.urls,
        instances: Object.keys(this._instances),
        peers: this._peers
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
    return Promise.resolve().then(() => {
      let Class = TYPES[type]
      if (Class) {
        // Type present locally
        let address = `name://${name || Math.floor((1 + Math.random()) * 1e6).toString(16)}`
        this._instances[address] = new Class(options)
        return address
      } else {
        // Type not present locally, see if a peer has it
        return Promise.resolve().then(() => {
          for (let peer of this._peers) {
            let types = peer.schemes['new']
            for (let key of Object.keys(types)) {
              let type_ = types[key]
              if (type_.name === type) {
                if (peer.process) {
                  // Peer is active, so use it
                  return peer
                } else {
                  // Peer is inactive, so `spawn` it
                  return this.spawn(peer)
                }
              }
            }
          }
          throw new Error(`Unknown type: ${type}`)
        }).then(peer => {
          // Request the peer to create a new instance of type
          let url = peer.urls[0]
          return POST(url + '/' + type, Object.assign({name: name}, options)).then(address => {
            // Store the instance as a URL to be proxied to. In other methods (e.g. `put`),
            // string instances are recognised as remote instances and requests are proxied to them
            this._instances[address] = `${url}/${address}`
            return address
          })
        })
      }
    })
  }

  /**
   * Get an instance
   * 
   * @param  {string} address - Address of instance
   * @return {Promise} - Resolves to the instance
   */
  get (address, proxy=true) {
    return Promise.resolve().then(() => {
      let instance
      if (address) {
        address = stencila.address.long(address)
        instance = this._instances[address]
      } else {
        instance = this
      }
      if (instance) {
        if (typeof instance !== 'string') {
          // Return local instance
          return instance
        }
        else {
          // Proxy request to peer
          return (proxy ? GET(instance) : instance)
        }
      } else {
        // Check if the address matches a registered type
        for (let name of Object.keys(TYPES)) {
          let Class = TYPES[name]
          if (typeof Class.match === 'function') {
            let match = Class.match(address)
            if (match) {
              let instance = new Class(match)
              this._instances[match] = instance
              return instance.import().then(() => {
                return instance
              })
            }
          }
        }
        throw new Error(`Unknown instance: ${address}`)
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
  put (address, method, args) {
    return this.get(address, false).then(instance => {
      if (typeof instance !== 'string') {
        let func = instance[method]
        if (func) {
          // Ensure arguments are an array
          if (args && !(args instanceof Array)) {
            if (args instanceof Object) {
              args = Object.keys(args).map(key => args[key])
            } else {
              args = [args]
            }
          }
          // Return method call result
          return instance[method](...args)
        } else {
          throw new Error(`Unknown method: ${method}`)
        }
      }
      else {
        // Proxy request to peer
        return PUT(`${instance}!${method}`, args)
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
          
          // Record start times
          this._started = new Date()
          this._heartbeat = new Date()
          
          // Register as a running host by creating a run file
          let file = path.join(this.tempDir(), 'hosts', this.id + '.json')
          mkdirp(path.dirname(file), error => {
            if (error) throw error
            fs.writeFile(file, JSON.stringify(this.manifest(), null, '  '), { mode: '600' }, error => {
              if (error) throw error
            })
          })
          console.log('Host has started at: ' + this.urls.join(', ')) // eslint-disable-line no-console

          // Discover other hosts
          this.discover()

          resolve()
        })
      } else {
        resolve()
      }
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
          fs.unlink(file, () => {})
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
            execa(`2>/dev/null 1>&2 xdg-open "${url}"`)
          } else {
            execa(`open "${url}"`)
          }
        })
    )
  }

  /**
   * Get this host's peers
   */
  get peers () {
    return this._peers
  }

  /**
   * Discover peers
   *
   * Looks for peer hosts in the following locations (on Linux, equivalents on other OSs):
   *
   * - `/tmp/stencila/hosts` - hosts that are currently active (i.e. running)
   * - `~/.local/share/stencila/hosts` - hosts that are installed but inactive
   *
   * Set the `interval` parameter to trigger ongoing discovery.
   *
   * @param {number} interval - The interval (seconds) between discovery attempts
   */
  discover (interval=0) {
    let discoverDir = dir => {
      fs.access(dir, fs.constants.R_OK, error => {
        if (error) return
        fs.readdir(dir, (error, files) => {
          if (error) throw error
          for (let file of files) {
            let manifest = JSON.parse(fs.readFileSync(path.join(dir, file), { encoding: 'utf8' }))
            // If the manifest defines a `process` then check that process is actually running
            if (manifest.process) {
              try {
                process.kill(manifest.process, 0)
              } catch (exception) {
                continue
              }
            }
            // Insert if the peer is not already in this._peers
            let insert = true
            if (manifest.id) {
              for (let peer of this._peers) {
                if (peer.id === manifest.id) {
                  insert = false
                  break
                }
              }
            }
            if (insert) this._peers.push(manifest)
          }
        })
      })
    }

    // Discover active hosts first
    discoverDir(path.join(this.tempDir(), 'hosts'))
    discoverDir(path.join(this.userDir(), 'hosts'))

    if (interval) setTimeout(() => this.discover(interval), interval*1000)
  }

  /**
   * Spawn a peer from an inactive host manifest
   * 
   * @param  {[type]} peer [description]
   * @return {[type]}      [description]
   */
  spawn (host) {
    return new Promise((resolve) => {
      let run = host.run
      let child = execa(run[0], run.slice(1))
      child.stdout.on('data', data => {
        let manifest = JSON.parse(data.toString())
        // Place at start of peers list
        this._peers.unshift(manifest)
        resolve(manifest)
      })
    })
  }

}

module.exports = Host
