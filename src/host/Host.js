const child = require('child-process-promise')
const os = require('os')

const version = require('../../package').version
const HostHttpServer = require('./HostHttpServer')

const NodeContext = require('../node-context/NodeContext')

const FilesystemArchive = require('../filesystem-archive/FilesystemArchive')

const SERVICES = {
  'NodeContext': NodeContext,

  'FilesystemArchive': FilesystemArchive
}

/**
 * A `Host` orchestrates `instances` and encapsulates application state.
 * This is a singleton class - there should only ever be one `Host`
 * in memory in each process (although, for purposes of testing, this is not enforced)
 */
class Host {

  constructor () {
    this._servers = {}
    this._instances = {}
  }

  options () {
    return Promise.resolve({
      stencila: {
        package: 'node',
        version: version
      },
      urls: Object.keys(this._servers).map(key => this._servers[key].url),
      services: Object.keys(SERVICES),
      instances: Object.keys(this._instances)
    })
  }

  post (type) {
    return new Promise((resolve, reject) => {
      let Class = SERVICES[type]
      if (Class) {
        let instance = new Class()
        let id = Math.floor((1 + Math.random()) * 1e6).toString(16)
        this._instances[id] = instance
        resolve(id)
      } else {
        reject(new Error(`Unknown service: ${type}`))
      }
    })
  }

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

  put (id, method, args) {
    args = args || []
    return new Promise((resolve, reject) => {
      let instance = this._instances[id]
      resolve(Promise.resolve(instance[method](...args)))
    })
  }

  delete (id) {
    return new Promise((resolve, reject) => {
      let instance = this._instances[id]
      if (instance) {
        delete this._instance[id]
        resolve()
      } else {
        reject(new Error(`Unknown instance: ${id}`))
      }
    })
  }

  start () {
    return new Promise((resolve, reject) => {
      if (!this._servers.http) {
        var server = new HostHttpServer(this)
        this._servers.http = server
        server.start().then(resolve)
      }
      resolve()
    })
  }

  stop () {
    return new Promise((resolve, reject) => {
      const type = 'http'
      let server = this._servers[type]
      if (server) {
        delete this._servers[type]
        server.stop().then(resolve)
      }
    })
  }

  view () {
    this.start()
      .then(() => {
        let url = this._servers.http.url
        if (os.platform() === 'linux') {
          child.exec(`2>/dev/null 1>&2 xdg-open "${url}"`)
        } else {
          child.exec(`open "${url}"`)
        }
      })
  }

}

module.exports = Host
