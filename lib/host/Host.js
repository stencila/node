const util = require('util')

const assert = require('assert')
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
   * Resolve an instance identifier to an instance
   *
   * @param  {String} id Instance identifier
   * @return {Object}      The instance
   */
  resolve (id) {
    return Promise.resolve().then(() => {
      let instance = this._instances[id]
      if (!instance) throw new Error(`No instance with id "${id}"`)
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
   * @return {Object} - Identier and newly created instance
   */
  async create (type, options) {
    this.heartbeat()

    const makeId = () => {
      let number = (this._counts[type] || 0) + 1
      this._counts[type] = number
      return `${type[0].toLowerCase()}${type.substring(1)}${number}`
    }

    let id
    let instance

    let Class = TYPES[type]
    if (Class) {
      // Type present locally
      id = makeId(type)
      instance = new Class(this, id, options)
      // Do initialization if class has such a method
      if (typeof instance.initialize === 'function') await instance.initialize()
    } else {
      // Type not present locally, see if a peer has it
      let peer = await (async () => {
        // Sort peers so that we search for the type in active, running peers
        // first and then in registered peers that need to be spawned
        let peers = Object.values(this._peers).sort((a, b) => {
          if (a.manifest.process && !b.manifest.process) return -1
          if (!a.manifest.process && b.manifest.process) return 1
          return 0
        })
        for (let peer of peers) {
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
      })()

      let remoteId = await this.requestPeer(peer, 'POST', '/' + type, options)

      // Store the instance as a {peer, id pair} to be proxied to. In other methods (e.g. `call`),
      // such object instances are recognised as remote instances and requests are proxied to them
      id = makeId(type)
      instance = {
        proxy: true,
        peer,
        id: remoteId
      }
    }

    this._instances[id] = instance
    return {id, instance}
  }

  /**
   * Get an instance
   *
   * @param {String} id - Instance identifier
   */
  async get (id) {
    this.heartbeat()

    let instance = await this.resolve(id)
    if (instance.proxy) {
      // Pass on request to peer host
      return this.requestPeer(instance.peer, 'GET', '/' + instance.id)
    } else {
      // Return an JSON represenation of the instance
      // excluding any 'private' propertues
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
  }

  /**
   * Call a method of an instance
   *
   * @param {String} id - Instance identifier
   * @param {String} method - Name of instance method
   * @param {Object} data - An object to apply the method to
   */
  async call (id, method, data) {
    this.heartbeat()

    let instance = await this.resolve(id)
    if (instance.proxy) {
      // Pass on request to peer host
      return this.requestPeer(instance.peer, 'PUT', '/' + instance.id + '!' + method, data)
    } else {
      let func = instance[method]
      if (func) {
        // Call the instance's method
        return instance[method](data)
      } else {
        throw new Error(`Instance "${id}" has no method "${method}"`)
      }
    }
  }

  /**
   * Destroy an instance
   *
   * @param  {String} id - Instance identifier
   */
  async destroy (id) {
    this.heartbeat()

    let instance = await this.resolve(id)
    if (instance.proxy) {
      // Pass on request to peer host
      return this.requestPeer(instance.peer, 'DELETE', '/' + instance.id)
    } else {
      // Do finalization if class has such a method
      if (typeof instance.finalize === 'function') await instance.finalize()
      // Delete the instance entry
      delete this._instances[id]
    }
  }

  /**
   * Start serving this host
   *
   * Currently, HTTP is the only server available
   * for hosts. We plan to implement a `HostWebsocketServer` soon.
   *
   * @return {Promise}
   */
  async start (options = {}) {
    let address = options.address || '127.0.0.1'
    let port = options.port || 2000
    let key = options.key || null
    let quiet = options.quiet || false

    if (!this._servers.http) {
      // Ensure key
      if (key === null) {
        if (process.env.STENCILA_AUTH === 'false') key = false
        else key = crypto.randomBytes(32).toString('hex')
      }
      this._key = key

      // Ensure MAC and IP
      const mac = await (util.promisify(machine.mac))()
      const ip = machine.ip()
      this._machine = {
        id: mac || ip,
        ip: ip
      }

      // Start HTTP server
      var server = new HostHttpServer(this, address, port)
      this._servers.http = server
      await server.start()

      if (!quiet) {
        let key = this._key
        console.log(`Host has started:\n  Id: ${this.id}\n  Key: ${key}\n  URLs: ${server.url}`) // eslint-disable-line no-console
        if (key === false) {
          console.warn(`  Warning: authentication has been disabled!`) // eslint-disable-line no-console
        }
      }

      // Record start times
      this._started = new Date()
      this._heartbeat = new Date()

      // Register as a running host by creating a manifest file and a key file
      let hostsDir = path.join(Host.tempDir(), 'hosts')
      mkdirp.sync(hostsDir)
      let manifest = await this.manifest()
      let json = JSON.stringify(manifest, null, '  ')
      fs.writeFileSync(path.join(hostsDir, this.id + '.json'), json, { mode: '600' })
      fs.writeFileSync(path.join(hostsDir, this.id + '.key'), this.key, { mode: '600' })

      // Discover other hosts
      return this.discoverPeers()
    }
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

          // Stop any child peers that this host spawned
          for (let peer of Object.values(this._peers)) {
            if (peer.child) {
              console.log(`Stopping peer host "${peer.id}".`)
              // Use both SIGINT and SIGTERM (which is not handled on Windows)
              peer.child.kill('SIGINT')
              peer.child.kill('SIGTERM')
            }
          }

          // Destroy all instances created to trigger any finalization they may do
          for (let id of Object.keys(this._instances)) {
            this.destroy(id)
          }

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

  registerPeer ({id, manifest, key}, child) {
    assert(id)
    assert(id !== this.id)

    let peer = {
      id,
      manifest: manifest || {},
      key,
      child,
      tokens: {} // TODO: garbage collection of expired tokens to reduce memory usage
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
   *
   * This method is intended to be robust to errors in peer files etc and
   * will only register an active peer if it can connect to it and access its
   * key file
   */
  async discoverPeers () {
    let discoverDir = async dir => {
      // Check the folder exists (they may not e.g. if no packages have been registered)
      try {
        await fs.accessSync(dir, fs.constants.R_OK)
      } catch (error) {
        return
      }
      // For each host in the directory
      for (let file of await glob(path.join(dir, '*.json'))) {
        let json
        try {
          json = fs.readFileSync(file, { encoding: 'utf8' })
        } catch (error) {
          console.warn(`Warning: error reading file "${file}": ${error.message}`)
          continue
        }

        let manifest
        try {
          manifest = JSON.parse(json)
        } catch (error) {
          console.warn(`Warning: error parsing file "${file}": ${error.message}`)
          continue
        }
        const id = manifest.id

        // Don't register no id or self as a peer!
        if (!id || id === this.id) continue

        // If the manifest defines a `process` then check that process is actually running
        const pid = manifest.process && manifest.process.pid
        if (pid) {
          try {
            process.kill(pid, 0)
          } catch (error) {
            if (error.code === 'ESRCH') {
              console.warn(`Warning: no active peer process with pid "${pid}"`)
            } else {
              console.warn(`Warning: error checking process with pid "${pid}": ${error.message}`)
            }
            continue
          }
        }

        // If the manifest defines `servers` then check that we are able to connect to
        // it and update the manifest
        if (manifest.servers && manifest.servers.http) {
          try {
            manifest = await this.requestPeer(manifest.servers.http.url + '/manifest')
          } catch (error) {
            console.warn(`Warning: error attempting to connect to peer: ${error.message}`)
            continue
          }
        }

        // If the manifest defines `servers` then obtain its key so that requests can
        // be made to it.
        let key
        if (manifest.servers && Object.keys(manifest.servers).length) {
          const keyFile = path.join(dir, id + '.key')
          try {
            key = fs.readFileSync(keyFile, { encoding: 'utf8' })
          } catch (error) {
            console.warn(`Warning: error reading file "${keyFile}": ${error.message}`)
            continue
          }
        }

        // If we got here, then it's OK to use this as a peer
        this.registerPeer({id, manifest, key})
      }
    }
    // Discover active hosts first,...
    await discoverDir(path.join(Host.tempDir(), 'hosts'))
    // ...then inactive hosts
    await discoverDir(path.join(Host.userDir(), 'hosts'))
    // ...then Jupyter kernels installed locally
    await JupyterContext.discover()
  }

  /**
   * Spawn a peer from an inactive host manifest
   *
   * @param  {Object} peer A peer object including `manifest`
   * @return {[type]}      [description]
   */
  spawnPeer (peer) {
    return new Promise((resolve, reject) => {
      let spawn = peer.manifest.spawn
      let child = execa(spawn[0], spawn.slice(1))
      child.stdout.on('data', data => {
        const spawnedPeer = JSON.parse(data.toString())
        this.registerPeer(spawnedPeer, child)
        resolve(spawnedPeer)
      })
      child.catch(error => {
        reject(new Error(`Could not spawn peer using "${spawn.join(' ')}": ${error.message}`))
      })
    })
  }

  async requestPeer (peer, method = 'GET', path = '', data = null) {
    let url
    let headers = {
      Accept: 'application/json'
    }
    if (typeof peer === 'string') {
      url = peer
    } else {
      url = peer.manifest.servers['http'].url
      headers['Authorization'] = 'Bearer ' + await this.generateToken(peer.id)
    }
    return request({
      method: method,
      uri: url + path,
      headers: headers,
      jar: true,
      body: data,
      json: true
    })
  }

  /**
   * Generate an authorization token for a peer host
   *
   * @param {String} host The id of the peer host
   */
  async generateToken (host) {
    let peer = this._peers[host]
    if (!peer) throw new Error(`Could not find peer with id "${host}"`)

    // If the peer has no key then auth is turned off
    // and so token is an empty string
    if (!peer.key) return ''

    return jsonwebtoken.sign({
      iss: this.id,
      jti: crypto.randomBytes(32).toString('hex')
    }, peer.key, {
      algorithm: 'HS256',
      expiresIn: 300
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

    // Note that `jsonwebtoken.verify` will return the
    // "decoded payload if the signature is valid and optional expiration, audience, or issuer are valid"
    let body = jsonwebtoken.verify(token, this.key, {
      algorithms: ['HS256']
    })

    // Verify `iss` and `jti`
    // These can, optionally, be set by clients to prevent token replay attacks.
    const iss = body.iss // Issuer
    const jti = body.jti // JWT ID
    if (iss && jti) {
      let peer = this._peers[iss]
      if (!peer) {
        // Request is from a host that is not yet registered
        peer = this.registerPeer({id: iss})
      }
      if (peer.tokens.hasOwnProperty(jti)) throw new Error(`Attempt to reuse a token with 'iss': "${iss}" and 'jti': "${jti}"`)
      peer.tokens[jti] = body
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

module.exports = Host
