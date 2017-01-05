const fs = require('fs')
const os = require('os')
const path = require('path')
const pathm = path

const Dat = require('dat-node')
const mkdirp = require('mkdirp')
const mime = require('mime')
const git = require('nodegit')
const request = require('request-promise')

const version = require('../../package').version
const Component = require('../component/Component')

const Folder = require('../folder/Folder')

const Document = require('../document/Document')
const DocumentProxy = require('../document/DocumentProxy')

const Sheet = require('../sheet/Sheet')

const BashSession = require('../bash-session/BashSession')
const JavascriptSession = require('../js-session/JavascriptSession')
const SessionProxy = require('../session/SessionProxy')

const HostHttpServer = require('./HostHttpServer')
const HostDataConverter = require('./HostDataConverter')

let home = path.join(os.homedir(), '.stencila')

/**
 * A `Host` orchestrates `Components` and encapsulates application state.
 * This is a singleton class - there should only ever be one `Host`
 * in memory in each process (although, for purposes of testing, this is not enforced)
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

  get type () {
    return 'nodejs-host'
  }

  get kind () {
    return 'host'
  }

  /**
   * Get the `Host` converter for a format
   *
   * @override
   * @param {string} format Format for conversion
   * @return {ComponentConverter} A converter object
   */
  static converter (format) {
    if (format === 'data') {
      return new HostDataConverter()
    } else {
      return super.converter(format)
    }
  }

  get schemes () {
    // TODO rather than a static enabled flag here may be better to use "builtin"
    // and then provide a button for things that users can enable (e.g. by installing
    // third party software)
    return {
      'new': {
        enabled: true
      },
      'id': {
        enabled: true
      },
      'file': {
        enabled: true
      },
      'http': {
        enabled: true
      },
      'https': {
        enabled: true
      },
      'ftp': {
        enabled: false
      },
      'git': {
        enabled: true
      },
      'dat': {
        enabled: false
      }
    }
  }

  get types () {
    return {
      'document': {
        formats: ['html']
      },
      'folder': {
        formats: []
      },
      'bash-session': {
        formats: []
      },
      'js-session': {
        formats: []
      }
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
   * - `schemes`: a list of schemes e.g. `git` that this host can handle
   * - `types`: a list of types of components this host can create
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
      schemes: this.schemes,
      types: this.types
    }
  }

  /**
   * Create a new component of a particular type
   *
   * @see  retrieve, load, clone, open
   *
   * @param  {string} type Type of component to create e.g. `'document'`
   * @return {Component|null} A new component, or `null` if `type` is unknown
   */
  create (type) {
    if (type === 'folder') return new Folder()
    else if (type === 'document') return new Document()
    else if (type === 'sheet') return new Sheet()
    else if (type === 'bash-session') return new BashSession()
    else if (type === 'js-session') return new JavascriptSession()
    else return null
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

  /**
   * Load a component from content of a particular format
   *
   * @param  {string} address Component address
   * @param  {string} content Content for component
   * @param  {string} format The format of the content
   * @return {Component|null} A component, or `null` if no converter for format is found
   */
  load (address, content, format) {
    for (let cls of [Document, Sheet]) {
      try {
        // Try to get a converter
        cls.converter(format)
      } catch (error) {
        // No converter, keep trying...
        continue
      }
      // Return component of that class
      let component = new cls(address) // eslint-disable-line new-cap
      component.load(content, format)
      return component
    }
    return null
  }

  /**
   * Read a component from a local file path
   *
   * If the path is a directory then it will be read as a pod,
   * otherwise the
   *
   * @param  {string} address Component address
   * @param  {string} path Local file system path
   * @return {Component|null} A component, or `null` if no converter for format is found
   */
  read (address, path) {
    if (fs.lstatSync(path).isDirectory()) {
      return new Folder(address, path)
    } else {
      let format = pathm.extname(path).substring(1)
      for (let cls of [Document, Sheet]) {
        try {
          // Try to get a converter
          cls.converter(format)
        } catch (error) {
          // No converter, keep trying...
          continue
        }
        // Return component of that class
        let component = new cls(address) // eslint-disable-line new-cap
        component.read(path)
        return component
      }
    }
    return null
  }

  clone (address, type) {
    return new Promise((resolve, reject) => {
      let {scheme, path, format, version} = this.split(address) // eslint-disable-line no-unused-vars

      if (scheme === 'file') {
        fs.access(path, fs.constants.R_OK, err => {
          if (err) {
            reject(new Error(
              `Local file system path does not exist or you do not have permission to read it\n  path: ${path}`
            ))
          } else {
            resolve(this.read(address, path))
          }
        })
      } else if (scheme === 'http' || scheme === 'https') {
        request({
          method: 'GET',
          url: `${scheme}://${path}`,
          resolveWithFullResponse: true
        })
        .then(response => {
          if (response.statusCode === 200) {
            let extension = pathm.extname(path)
            if (!extension) {
              type = response.headers['content-type']
              extension = mime.extension(type)
            }
            let format = extension.substring(1)
            resolve(this.load(address, response.body, format))
          } else {
            reject(new Error(`Error fetching address\n address: ${address}\n  message: ${response.body}`))
          }
        })
        .catch(error => {
          reject(error)
        })
      } else if (scheme === 'git') {
        let match = path.match(/([\w\-\.]+)\/([\w\-]+\/[\w\-]+)(\/(.+))?$/) // eslint-disable-line no-useless-escape
        if (match) {
          let host = match[1]
          let hostDir = (host === 'stenci.la') ? '' : host
          let repo = match[2]
          let repoDir = pathm.join(home, hostDir, repo)
          let masterDir = pathm.join(repoDir, 'master')
          let file = match[4]

          Promise.resolve(fs.existsSync(masterDir)).then(exists => {
            if (exists) return git.Repository.open(masterDir)
            else return git.Clone(`https://${host}/${repo}.git`, masterDir)
          }).then(repo => {
            // If a version other than master is specified...
            if (version && version !== 'master') {
              // Find the commit matching the (possibly) shorthand version e.g. 1.0, d427bc
              return git.AnnotatedCommit.fromRevspec(repo, version).then(annotatedCommit => {
                return git.Commit.lookup(repo, annotatedCommit.id())
              }).then(commit => {
                let sha = commit.sha()
                let versionDir = pathm.join(repoDir, sha)
                if (fs.existsSync(versionDir)) {
                  return versionDir
                } else {
                  return git.Clone(masterDir, versionDir).then(clone => {
                    return clone.getCommit(sha).then(commit => {
                      return git.Checkout.tree(clone, commit, { checkoutStrategy: git.Checkout.STRATEGY.FORCE })
                    }).then(() => {
                      return versionDir
                    })
                  })
                }
              })
            } else {
              return masterDir
            }
          }).then((dir) => {
            let path = file ? pathm.join(dir, file) : dir
            let component = this.read(address, path)
            resolve(component)
          }).catch(error => {
            reject(error)
          })
        } else {
          reject(new Error(`Unable to determine Git repository URL from address\n  address: ${address}`))
        }
      } else if (scheme === 'dat') {
        // See https://github.com/datproject/dat/blob/master/commands/download.js for
        // guidance on how to approach this
        // Also consider using a "DIY" approach by using `hyperdrive` and `hyperdrive-archive-swarm`
        // modules instead of the higher level `dat-js` module. See http://docs.dat-data.com/diy-dat
        let match = path.match(/([\w]+)(\/(.+))?$/)
        let key = match[1]
        let subpath = match[2]
        let dir = pathm.join(home, '.dat', key)
        let filepath = subpath ? pathm.join(dir, subpath) : dir
        mkdirp(dir, err => {
          if (err) reject(err)

          // If a dat already exists then `dat.download()` will go into live sync mode
          // in which is waits for peers to update the dat. It also obtains a lock on that dat
          // and prevents this process (and any other?) from opening it with another `dat.download`
          // call. To avoid this situation we check for and existing dat.
          if (fs.existsSync(pathm.join(dir, '.dat'))) {
            resolve(this.read(address, filepath))
          } else {
            let dat = Dat({dir: dir, key: key})

            dat.on('error', err => {
              reject(err)
            })

            dat.download(err => {
              // It seems that this is only called when there is an error
              if (err) reject(err)
            })

            dat.on('connecting', () => {
              console.log('Dat connecting')
            })
            dat.on('swarm-update', () => {
              console.log('Dat swarm-update')
            })
            dat.on('key', key => {
              console.log('Dat key available: ' + key)
            })
            dat.on('download', () => {
              console.log('Dat downloading')
            })

            dat.on('download-finished', err => {
              if (err) reject(err)
              console.log('Dat download finished')
              resolve(this.read(address, filepath))
            })
          }
        })
      } else {
        resolve(null)
      }
    })
  }

  /**
   * Open a `Component` at an address
   *
   * @example
   *
   * // Create a new document
   * host.open('+document')
   *
   * @example
   * host.open('stats/t-test')
   *
   * @param      {string}  address  The address
   * @return     {Component}  { description_of_the_return_value }
   */
  open (address) {
    return new Promise((resolve, reject) => {
      // No address, return this host
      if (address === null) resolve(this)

      address = this.long(address)
      let {scheme, path, format, version} = this.split(address) // eslint-disable-line no-unused-vars

      // `new` scheme, attempt to create a component
      if (scheme === 'new') {
        let component = this.create(path)
        if (component) return resolve(component)
      }

      // Attempt to retreive address
      let component = this.retrieve(address)
      if (component) return resolve(component)

      // Attempt to clone address
      this.clone(address).then(component => {
        if (component) return resolve(component)

        // Not able to clone address, so ask peers
        this.ask(address).then(component => {
          if (component) {
            this.register(component)
            return resolve(component)
          }

          reject(new Error(`Unable to open address.  address: ${address}`))
        }).catch(error => reject(error))
      }).catch(error => reject(error))
    })
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
   * Say "hello" to a peer
   *
   * When a host attempts to `discover()` peers it does a HTTP `PUT` request to
   * the `/!hello` endpoint. This method responds to that request by:
   *
   * 1. Recording the peer's manifest in this host's peer list (replacing or appending as appropriate)
   * 2. Providing the peer with this host's own manifest
   *
   * @param      {Object}    manifest  The peer's manifest
   * @return     {Object}    This host's manifest
   */
  hello (manifest) {
    if (!manifest) throw new Error('No manifest supplied')

    let replaced = false
    for (let index in this._peers) {
      let peer = this._peers[index]
      if (peer.id === manifest.id) {
        this._peers[index] = manifest
        replaced = true
      }
    }
    if (!replaced) this._peers.push(manifest)
    return this.manifest
  }

  /**
   * Discover peers on the local machine
   *
   * This method scans the ports 2000, 2010,...3000 on the 127.0.0.1 address
   * making a `POST /!hello` request with this host's manifest.
   * If another Stencila host is listening on the port then it will respond
   * with it's own manifest and will be added to this host's list of peers.
   *
   * Since we're doing this locally only, rather than port scanning we should
   * keep a registry of serving hosts in `~/.stencila/stencila.sqlite3` or similar
   *
   * Note that a peer may not be serving (it's url will be `null`) i.e. it
   * will be able to `ask()` this host for addresses but this host won't be
   * able to ask it for anything.
   *
   * @return {Host} This host
   */
  discover () {
    this._peers = []
    let thisPort = this.servers.http ? this.servers.http.port : null
    for (let port = 2000; port <= 3000; port += 10) {
      if (port !== thisPort) {
        request({
          method: 'POST',
          url: `http://127.0.0.1:${port}/!hello`,
          body: [
            this.manifest
          ],
          json: true,
          resolveWithFullResponse: true
        })
        .then(response => {
          if (response.statusCode === 200) {
            let manifest = response.body
            if (manifest.stencila) {
              this.hello(manifest)
            }
          }
        })
        .catch(error => {
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
   * host's peers. If the peer is serving and the scheme of the address is amongst
   * the peer's schemes the peer will be asked to open the address.
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
          peer.url &&
          (peer.schemes.indexOf(scheme) >= 0) &&
          (
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
              let id = data.id
              let address = data.address
              let url = data.url
              if (type === 'document') {
                resolve(new DocumentProxy(type, id, address, url))
              } else if (type.substring(type.length - 7) === 'session') {
                resolve(new SessionProxy(type, id, address, url))
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

  /**
   * Start up this host (start servers and discover peers)
   *
   * @return {Host} This host
   */
  startup () {
    return this.serve().then(() => {
      return this.discover()
    })
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
