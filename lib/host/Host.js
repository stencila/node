const util = require('util')

const machine = require('address')
const crypto = require('crypto')
const execa = require('execa')
const fs = require('fs')
const glob = util.promisify(require('glob'))
const jsonwebtoken = require('jsonwebtoken')
const mkdirp = require('mkdirp')
const path = require('path')
const os = require('os')
const request = require('request-promise')
const uuid = require('uuid')

const pkg = require('../../package')
const HostHttpServer = require('./HostHttpServer')

const JupyterContext = require('../contexts/JupyterContext')
const NodeContext = require('../contexts/NodeContext')
const SqliteContext = require('../contexts/SqliteContext')

const version = pkg.version

// The current execution environment
// The `STENCILA_ENVIRON` env var may be set if inside
// a defined environment e.g. stencila/core@1.2
const ENVIRON = process.env.STENCILA_ENVIRON || 'local'

// Types of execution contexts provided by this Host
// Note that types provided by peers are also available
// to clients of this host. See `Host.types`
const TYPES = {
  'JupyterContext': JupyterContext,
  'NodeContext': NodeContext,
  'SqliteContext': SqliteContext
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
 * A `Host` is not limited to being served by HTTP and it's methods are exposed by both `HostHttpServer`
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
   * Get the execution environments supported by this host
   *
   * @return {Array} A list of supported execution environment
   */
  async environs () {
    let environs = []

    let name = null
    let version = null
    const match = ENVIRON.match(/^([\w-]+)(@(.+)?)$/)
    if (match) {
      name = match[1]
      version = match[3]
    } else {
      name = ENVIRON
    }
    let current = {
      id: ENVIRON,
      name: name,
      version: version
    }
    environs.push(current)

    const pattern = path.join(Host.userDir(), 'environs', '**/*.json')
    for (let file of glob.sync(pattern)) {
      const json = fs.readFileSync(file)
      const environ = JSON.parse(json)
      environs.push(environ)
    }
    return environs
  }

  /**
   * Get specifications for context types provided by this
   * Host, including types provided by peer Hosts.
   *
   * Types which are provided by this Host directly are marked
   * with `local: true`, and those provided by peers with
   * `local: false`
   */
  get types () {
    let specs = {}
    for (let [name, type] of Object.entries(TYPES)) {
      specs[name] = Object.assign(type.spec, {local: true})
    }
    for (let peer of Object.values(this._peers)) {
      const types = peer && peer.manifest && peer.manifest.types
      if (types) {
        for (let [name, spec] of Object.entries(types)) {
          // Only add the type if it is not available locally
          // on this host
          if (!specs[name]) {
            specs[name] = Object.assign(spec, {local: false})
          }
        }
      }
    }
    return specs
  }

  /**
   * Get information on the machine that this host is running on
   *
   * Used for resolving data pointers (amongst other things)
   *
   * @return {Object} Machine information
   */
  get machine () {
    return this._machine
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
   * @return {Object} Manifest object
   */
  async manifest () {
    let manifest = {
      stencila: {
        package: 'node',
        version: version
      },
      id: this.id,
      spawn: ['stencila-node', 'spawn'],
      environs: await this.environs(),
      types: this.types
    }
    if (this._started) {
      manifest = Object.assign(manifest, {
        machine: this.machine,
        process: this.process,
        servers: this.servers,
        instances: Object.keys(this._instances)
      })
    }
    return manifest
  }

  /**
   * Register as a host for the current execution environment.
   *
   * Registering a host involves creating a file `node.json` inside of
   * the current environment's directory within the the user's
   * Stencila data directory (see `userDir()`).
   */
  async register () {
    const dir = path.join(Host.userDir(), 'hosts')
    mkdirp.sync(dir)
    const json = JSON.stringify(await this.manifest(), null, '  ')
    fs.writeFileSync(path.join(dir, 'node.json'), json)
  }

  /**
   * Resolve a name to an instance
   *
   * @param  {String} name Name of instance
   * @return {Object}      The instance
   */
  resolve (name) {
    return Promise.resolve().then(() => {
      let instance = this._instances[name]
      if (!instance) throw new Error(`No instance with name "${name}"`)
      return instance
    })
  }

  async startup (id) {
    if (id === ENVIRON) {
      return { path: '' }
    } else {
      throw new Error('Creating environments other than local not yet supported')
    }
  }

  async shutdown (id) {
    return true
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
            const types = peer && peer.manifest && peer.manifest.types
            if (types) {
              for (let name of Object.keys(types)) {
                if (name === type) {
                  if (peer.manifest.process) {
                    // Peer is active, so use it
                    return peer
                  } else {
                    // Peer is inactive, so `spawn` it
                    return this.spawnPeer(peer)
                  }
                }
              }
            }
          }
          throw new Error(`No type with name "${type}"`)
        }).then((peer) => {
          // Request the peer to create a new instance of type
          let url = peer.manifest.servers['http'].url
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
   * @param {Object} data - An object to apply the method to
   * @return {Promise} Resolves to result of method call
   */
  call (name, method, data) {
    this.heartbeat()
    return this.resolve(name).then(instance => {
      if (instance instanceof Proxy) return instance.call(method, data)
      else {
        let func = instance[method]
        if (func) {
          return instance[method](data)
        } else {
          throw new Error(`No method with name "${method}"`)
        }
      }
    }).catch(error => {
      return {
        messages: [{
          type: 'error',
          message: error.message,
          stack: error.stack
        }]
      }
    })
  }

  /**
   * Delete an instance
   *
   * @param  {string} name - Name of instance
   * @return {Promise}
   */
  delete (name) {
    this.heartbeat()
    return new Promise((resolve, reject) => {
      let instance = this._instances[name]
      if (instance) {
        const del = () => {
          delete this._instances[name]
          resolve()
        }
        // Do finalization if class has such a method
        if (typeof instance.finalize === 'function') {
          return instance.finalize.then(del)
        } else {
          del()
        }
      } else {
        reject(new Error(`No instance with name "${name}"`))
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
  start (options = {}) {
    let address = options.address || '127.0.0.1'
    let port = options.port || 2000
    let key = options.key || null
    let quiet = options.quiet || false

    return new Promise((resolve, reject) => {
      if (key === null) {
        if (process.env.STENCILA_AUTH === 'false') key = false
        else key = crypto.randomBytes(32).toString('hex')
      }
      this._key = key

      machine.mac((error, mac) => {
        if (error) reject(error)

        const ip = machine.ip()
        this._machine = {
          id: mac || ip,
          ip: ip
        }
        resolve()
      })
    }).then(() => {
      if (!this._servers.http) {
        // Start HTTP server
        var server = new HostHttpServer(this, address, port)
        this._servers.http = server
        return server.start().then(() => {
          if (!quiet) {
            let key = this._key
            console.log(`Host HTTP server has started:\n  URL: http://${server.address}:${server.port}\n  Key: ${key}`) // eslint-disable-line no-console
            if (key === false) {
              console.warn(`  Warning: authentication has been disabled!`) // eslint-disable-line no-console
            }
          }

          // Record start times
          this._started = new Date()
          this._heartbeat = new Date()

          // Register as a running host by creating a manifest file and a key file
          let hostsDir = path.join(Host.tempDir(), 'hosts')
          mkdirp(hostsDir, error => {
            if (error) throw error

            this.manifest().then(manifest => {
              let json = JSON.stringify(manifest, null, '  ')
              fs.writeFile(path.join(hostsDir, this.id + '.json'), json, { mode: '600' }, error => {
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
  stop (options = {}) {
    let quiet = options.quiet || false

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

          if (!quiet) console.log('Host HTTP server has stopped.') // eslint-disable-line no-console

          resolve()
        })
      }
    })
  }

  /**
   * Start serving this host and wait for connections
   * indefinitely
   */
  run (options = {}) {
    let address = options.address || '127.0.0.1'
    let port = options.port || 2000
    let key = options.key || null
    let timeout = options.timeout || Infinity
    let duration = options.duration || Infinity
    let quiet = options.quiet || false

    const stop = () => {
      this.stop({quiet: quiet}).then(() => {
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

    return this.start({address, port, key, quiet})
  }

  async spawn (options = {}) {
    options.quiet = true
    await this.run(options)
    return {
      id: this.id,
      manifest: this.manifest,
      key: this.key
    }
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

  registerPeer ({id, manifest, key}) {
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
        glob(path.join(dir, '*.json')).then((files) => {
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
            this.registerPeer({id, manifest, key})
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
   * @param  {Object} peer A peer object including `manifest`
   * @return {[type]}      [description]
   */
  async spawnPeer (peer) {
    let spawn = peer.manifest.spawn
    let child = execa(spawn[0], spawn.slice(1))
    child.stdout.on('data', data => {
      const result = JSON.parse(data)
      this.registerPeer(result)
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

  /**
   * Authorize a request token
   *
   * @param {String} token Token string (usually from the `Authorization` header of a HTTP request)
   */
  authorizeToken (token) {
    // If key is explicitly set to false then no authorization is done
    if (this._key === false) return true

    let body = jsonwebtoken.verify(token, this.key, {
      algorithms: ['HS256']
    })

    // Test request sequence order if `hid` (host id) and `seq` (sequence) claims
    // are in token body. These can, optionally, be set by clients to prevent token replay attacks.
    const hid = body.hid
    const seq = body.seq
    if (hid && seq) {
      let peer = this._peers[hid]
      if (!peer) {
        // Request is from a host that is not yet registered
        peer = this.registerPeer({id: hid})
      }
      if (seq <= peer.received) throw new Error('Token `seq` is out of sequence')
      // Update `received` sequence number
      peer.received = seq
    }

    return body
  }

  /**
   * Compile a library
   *
   * @param  {Object} options Options for the `NodeContext.compileLibrary` method
   * @return {Object}     Library node including `bundle`, the path to the bundle created
   */
  async compile (options) {
    const context = new NodeContext()
    return context.compileLibrary(options)
  }
}

class Proxy {
  constructor (url) {
    this.url = url
  }

  get () {
    return GET(this.url)
  }

  call (method, data) {
    return PUT(this.url + '!' + method, data)
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
