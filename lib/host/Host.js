const machine = require('address')
const crypto = require('crypto')
const execa = require('execa')
const fs = require('fs')
const glob = require('glob')
const jsonwebtoken = require('jsonwebtoken')
const mkdirp = require('mkdirp')
const path = require('path')
const os = require('os')
const request = require('request-promise')
const uuid = require('uuid')

const version = require('../../package').version
const HostHttpServer = require('./HostHttpServer')

const Context = require('../contexts/Context')
const JupyterContext = require('../contexts/JupyterContext')
const NodeContext = require('../contexts/NodeContext')

// Resource types
const TYPES = {
  'Context': Context,
  'JupyterContext': JupyterContext,
  'NodeContext': NodeContext
}
// Resource types specifications map
let TYPES_SPECS = {}
for (let name of Object.keys(TYPES)) {
  TYPES_SPECS[name] = TYPES[name].spec
}

/**
 * A `Host` allows you to create, get, run methods of, and delete instances of various types.
 * The types can be thought of a "services" provided by the host e.g. `NoteContext`
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
  constructor (key = null) {
    this._id = `node-host-${uuid()}`
    this._key = key
    this._servers = {}
    this._started = null
    this._heartbeat = null
    this._instances = {}
    this._counts = {}
    this._peers = {}
  }

  /**
   * Get unique ID of this host
   */
  get id () {
    return this._id
  }

  /**
   * Get the key of this host
   *
   * @return {string} - Host's authentication key
   */
  get key () {
    return this._key
  }

  /**
   * Get the current user's Stencila data directory
   */
  static userDir () {
    // TODO: isn't there a module helping us to find OS paths?
    // maybe something which works like electron's app.getPath()
    // https://github.com/electron/electron/blob/master/docs/api/app.md#appgetpathname
    switch (process.platform) {
      // see https://nodejs.org/api/process.html#process_process_platform
      case 'darwin':
        return path.join(process.env.HOME, 'Library', 'Application Support', 'Stencila')
      case 'linux':
        return path.join(process.env.HOME, '.stencila')
      case 'win32':
        return path.join(process.env.APPDATA, 'Stencila')
      default:
        return path.join(process.env.HOME, 'stencila')
    }
  }

  /**
   * Is the user running this process a super user?
   */
  static isSuperUser () {
    return (process.getuid && process.getuid() === 0) || process.env.SUDO_UID
  }

  /**
   * Get the current Stencila temporary directory
   */
  static tempDir () {
    return path.join(os.tmpdir(), 'stencila')
  }

  /**
   * Get the environments supported by this host
   *
   * @return {Promise} Resolves to a list of environment specs
   */
  environs () {
    // The `STENCILA_ENVIRON` env var may be set if inside
    // a well defined environment e.g. stencila/core@1.2
    const id = process.env.STENCILA_ENVIRON || 'local'
    let name = id
    let version = null
    const match = id.match(/([^@]+)+@(.+)/)
    if (match) {
      name = match[1]
      version = match[2]
    }
    return Promise.resolve([{
      id: id,
      name: name,
      version: version,
      servers: {
        http: {
          path: '/'
        }
      }
    }])
  }

  /**
   * Get information on the machine that this host is running on
   *
   * Used for resolving data pointers (amongst other things)
   *
   * @return {Object} Machine information
   */
  get machine () {
    return {
      mac: this._mac,
      ip: this._ip
    }
  }

  /**
   * Get information on the process that this host is running in
   *
   * Used by peer hosts to check that this host is runing (amongst other things)
   *
   * @return {Object} Process information
   */
  get process () {
    return {
      pid: process.pid,
      name: process.title,
      version: process.version,
      platform: process.platform,
      arch: process.arch
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
    let manifest = {
      stencila: {
        package: 'node',
        version: version
      },
      id: this.id,
      run: [process.execPath, '-e', "require('stencila-node').run()"],
      types: TYPES_SPECS
    }
    if (this._started) {
      manifest = Object.assign(manifest, {
        machine: this.machine,
        process: this.process,
        servers: this.servers,
        instances: Object.keys(this._instances)
      })
    }
    return Promise.resolve(manifest)
  }

  /**
   * Register this Stencila Host on this machine.
   *
   * Registering a host involves creating a file `node.json` inside of
   * the user's Stencila data (see `userDir()`) directory which describes
   * the capabilities of this host.
   */
  register () {
    this.manifest().then(manifest => {
      let dir = path.join(Host.userDir(), 'hosts')
      mkdirp(dir, error => {
        if (error) throw error
        fs.writeFile(path.join(dir, 'node.json'), JSON.stringify(manifest, null, '  '), error => {
          if (error) throw error
        })
      })
    })
  }

  /**
   * Resolve a name to an instance
   *
   * @param  {String} name Name of instance
   * @return {Object}      The instance
   */
  resolve (name) {
    return Promise.resolve().then(() => {
      if (!name) return this
      let instance = this._instances[name]
      if (!instance) throw new Error(`No instance found with name "${name}"`)
      return instance
    })
  }

  /**
   * Create a new instance of a type
   *
   * @param  {string} type - Type of instance
   * @param  {options} options - Arguments to be passed to type constructor
   * @return {Promise} - Resolves to the ID string of newly created instance
   */
  create (type, options) {
    this.heartbeat()

    const makeName = () => {
      let number = (this._counts[type] || 0) + 1
      this._counts[type] = number
      return `${type[0].toLowerCase()}${type.substring(1)}${number}`
    }

    return Promise.resolve().then(() => {
      let Class = TYPES[type]
      if (Class) {
        // Type present locally
        let name = makeName(type)
        let instance = new Class(this, name, options)
        this._instances[name] = instance
        // Do initialization if class has such a method
        if (typeof instance.initialize === 'function') {
          return instance.initialize().then(() => {
            return {name, instance}
          })
        } else {
          return {name, instance}
        }
      } else {
        // Type not present locally, see if a peer has it
        return Promise.resolve().then(() => {
          for (let peer of Object.values(this._peers)) {
            for (let key of Object.keys(peer.types)) {
              let type_ = peer.types[key]
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
        }).then((peer) => {
          // Request the peer to create a new instance of type
          let url = peer.servers['http'].url
          return POST(url + '/' + type, options).then(remoteAddress => {
            // Store the instance as a URL to be proxied to. In other methods (e.g. `put`),
            // string instances are recognised as remote instances and requests are proxied to them
            let instance = new Proxy(`${url}/${remoteAddress}`)
            let name = makeName(type)
            this._instances[name] = instance
            return {name, instance}
          })
        })
      }
    })
  }

  /**
   * Get an instance
   *
   * @param  {String} name - Name of instance
   * @return {Promise} - Resolves to a representation of the instance
   */
  get (name) {
    this.heartbeat()
    return this.resolve(name).then(instance => {
      if (instance instanceof Proxy) return instance.get()
      else {
        if (typeof instance.repr === 'function') {
          return instance.repr()
        } else {
          let repr = {}
          for (const [key, value] of Object.entries(instance)) {
            if (key.substring(0, 1) !== '_') repr[key] = value
          }
          return repr
        }
      }
    })
  }

  /**
   * Call a method of an instance
   *
   * @param  {String} name - Name of instance
   * @param {String} method - Name of instance method
   * @param {Array} args - An array of method arguments
   * @return {Promise} Resolves to result of method call
   */
  call (name, method, args) {
    this.heartbeat()
    return this.resolve(name).then(instance => {
      if (instance instanceof Proxy) return instance.call(method, args)
      else {
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
    })
  }

  /**
   * Delete an instance
   *
   * @param  {string} id - ID of instance
   * @return {Promise}
   */
  delete (id) {
    this.heartbeat()
    return new Promise((resolve, reject) => {
      let instance = this._instances[id]
      if (instance) {
        const del = () => {
          delete this._instances[id]
          resolve()
        }
        // Do finalization if class has such a method
        if (typeof instance.finalize === 'function') {
          return instance.finalize.then(del)
        } else {
          del()
        }
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
  start (address = '127.0.0.1', port = 2000, key = null) {
    return new Promise((resolve, reject) => {
      if (key === null) {
        if (process.env.STENCILA_AUTH === 'false') key = false
        else key = crypto.randomBytes(64).toString('base64')
      }
      this._key = key
      machine.mac((error, mac) => {
        if (error) reject(error)

        this._mac = mac
        this._ip = machine.ip()
        resolve()
      })
    }).then(() => {
      if (!this._servers.http) {
        // Start HTTP server
        var server = new HostHttpServer(this, address, port)
        this._servers.http = server
        return server.start().then(() => {
          // Record start times
          this._started = new Date()
          this._heartbeat = new Date()

          // Register as a running host by creating a manifest file and a key file
          let hostsDir = path.join(Host.tempDir(), 'hosts')
          mkdirp(hostsDir, error => {
            if (error) throw error

            this.manifest().then(manifest => {
              fs.writeFile(path.join(hostsDir, this.id + '.json'), JSON.stringify(manifest, null, '  '), { mode: '600' }, error => {
                if (error) throw error
              })
            })

            fs.writeFile(path.join(hostsDir, this.id + '.key'), this.key, { mode: '600' }, error => {
              if (error) throw error
            })
          })

          // Discover other hosts
          return this.discoverPeers()
        })
      } else {
        return Promise.resolve()
      }
    })
  }

  /**
   * Update this host's heartbeat
   *
   * Can be called explictly by a peer (i.e. `PUT /!heartbeat`)
   * but also called by the `post`, `get`, `put` and `delete` methods
   * above.
   *
   * @return {Date} Date/time of last heartbeat
   */
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
          // Deregister as a running host by removing manifest and key files
          let hostsDir = path.join(Host.tempDir(), 'hosts')
          let manifestFile = path.join(hostsDir, this.id + '.json')
          fs.unlink(manifestFile, () => {})
          let keyFile = path.join(hostsDir, this.id + '.key')
          fs.unlink(keyFile, () => {})
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
  run (address = '127.0.0.1', port = 2000, key = null, timeout = Infinity, duration = Infinity) {
    const stop = () => {
      this.stop().then(() => {
        process.exit()
      })
    }

    // Setup timer to check timeout and duration every minute
    setInterval(() => {
      const time = new Date()
      if ((time - this._heartbeat) / 1000 > timeout || (time - this._started) / 1000 >= duration) {
        stop()
      }
    }, 60 * 1000)

    // Handle interrupt
    if (process.platform === 'win32') {
      var rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      })
      rl.on('SIGINT', () => process.emit('SIGINT'))
    }
    process.on('SIGINT', stop)

    return this.start(address, port, key)
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
    let servers = {}
    for (let name of Object.keys(this._servers)) {
      let server = this._servers[name]
      servers[name] = {
        url: server.url,
        address: server.address,
        port: server.port
      }
    }
    return servers
  }

  /**
   * Get a list of URLs for this host
   *
   * @return {array} Array of strings
   */
  get urls () {
    return Object.keys(this._servers).map(name => this._servers[name].url)
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

  registerPeer (id, manifest, key) {
    let peer = {
      manifest,
      key,
      sent: 0,
      received: 0
    }
    this._peers[id] = peer
    return peer
  }

  /**
   * Discover peers
   *
   * Looks for peer hosts in the following locations (on Linux, equivalents on other OSs):
   *
   * - `/tmp/stencila/hosts` - hosts that are currently active (i.e. running)
   * - `~/.stencila/hosts` - hosts that are installed but inactive
   */
  discoverPeers () {
    let discoverDir = async dir => {
      fs.access(dir, fs.constants.R_OK, error => {
        if (error) return
        glob(path.join(dir, '*.json'), (error, files) => {
          if (error) console.warn(error)
          for (let file of files) {
            let json
            try {
              json = fs.readFileSync(file, { encoding: 'utf8' })
            } catch (readError) {
              console.warn(readError)
              return
            }
            let manifest
            try {
              manifest = JSON.parse(json)
            } catch (parseError) {
              console.warn(`Could not parse ${file}: ${parseError}`)
              return
            }
            const id = manifest.id
            // If the manifest defines a `process` then check that process is actually running
            if (manifest.process && manifest.process.pid) {
              try {
                process.kill(manifest.process.pid, 0)
              } catch (error) {
                // Skip this peer
                continue
              }
            }
            // If the manifest defines `servers` then obtain its key so that requests can
            // be made to it.
            let key
            if (manifest.servers) {
              try {
                key = fs.readFileSync(path.join(dir, id + '.key'), { encoding: 'utf8' })
              } catch (error) {
                // Skip this peer
                continue
              }
            }
            this.registerPeer(id, manifest, key)
          }
        })
      })
    }

    return Promise.resolve().then(() => {
      // Discover active hosts first,...
      return discoverDir(path.join(Host.tempDir(), 'hosts'))
    }).then(() => {
      // ...then inactive hosts
      return discoverDir(path.join(Host.userDir(), 'hosts'))
    }).then(() => {
      // ...then Jupyter kernels installed locally
      return JupyterContext.discover()
    })
  }

  /**
   * Spawn a peer from an inactive host manifest
   *
   * @param  {[type]} manifest The manifest for the inactive host
   * @return {[type]}      [description]
   */
  spawn (manifest) {
    return new Promise((resolve) => {
      let run = manifest.run
      let child = execa(run[0], run.slice(1))
      child.stdout.on('data', data => {
        // Get the peer's manifest which is output from executing the `run` command
        let peer = JSON.parse(data.toString())
        // To obtain an authorization token cookie, connect to the peer using the HTTP url
        // and ticket in the manifest
        let server = peer.servers['http']
        if (!server) throw new Error(`HTP server not provided in manifest for peer: ${peer.id}`)
        let url = server.url
        let ticket = server.ticket
        if (!(url && ticket)) throw new Error(`URL and ticket not provided in manifest for peer: ${peer.id}`)
        GET(`${url}`).then((manifest) => {
          this._peers[manifest.id] = {manifest}
          resolve(manifest)
        })
      })
    })
  }

  /**
   * Generate an authorization token for a peer host
   *
   * @param {String} host The id of the peer host
   */
  generateToken (host) {
    return Promise.resolve().then(() => {
      let peer = this._peers[host]
      if (!(peer && peer.key)) {
        return this.discoverPeers().then(() => {
          peer = this._peers[host]
          if (!(peer && peer.key)) throw new Error('Could not find key for host "' + host + '"')
          else return peer
        })
      } else {
        return peer
      }
    }).then(peer => {
      if (!peer.key) {
        console.log(this._peers)
        throw new Error('No key available for host "' + host + '"')
      }
      // Increment and update `sent` sequence number
      const sent = peer.sent + 1
      peer.sent = sent

      return jsonwebtoken.sign({
        hid: this.id,
        seq: sent
      }, peer.key, {
        algorithm: 'HS256',
        expiresIn: 300
      })
    })
  }

  authorizeToken (token) {
    let body = jsonwebtoken.verify(token, this.key, {
      algorithms: ['HS256']
    })
    const hid = body.hid
    if (!hid) throw new Error('No `hid` property in token body')
    const seq = body.seq
    if (!body.seq) throw new Error('No `seq` property in token body')

    // Check that the request is in sequence to avoid replay attacks
    let peer = this._peers[hid]
    if (!peer) {
      // Request is from a host that is not yet registered
      peer = this.registerPeer(hid)
    }
    if (seq <= peer.received) throw new Error('Token `seq` is out of sequence')

    // Update `received` sequence number
    peer.received = seq

    return body
  }
}

class Proxy {
  constructor (url) {
    this.url = url
  }

  get () {
    return GET(this.url)
  }

  call (method, args) {
    return PUT(this.url + '!' + method, args)
  }
}

function request_ (method, url, data) {
  return request({
    method: method,
    uri: url,
    headers: {
      Accept: 'application/json'
    },
    jar: true,
    body: data,
    json: true
  })
}

function GET (url) {
  return request_('GET', url)
}

function POST (url, data) {
  return request_('POST', url, data)
}

function PUT (url, data) {
  return request_('PUT', url, data)
}

module.exports = Host
