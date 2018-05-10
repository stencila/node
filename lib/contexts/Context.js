const uuid = require('uuid')
const request = require('request-promise')

class Context {
  constructor (host, name) {
    this._host = host
    this._id = `node-${this.constructor.name.toLowerCase()}-${uuid()}`
    this._name = name
    this._variables = {}
  }

  get host () {
    return this._host
  }

  get id () {
    return this._id
  }

  get name () {
    return this._name
  }

  get location () {
    return {
      context: {
        id: this._id,
        name: this._name
      },
      host: {
        id: this._host.id,
        port: this._host.servers.http && this._host.servers.http.port
      },
      machine: {
        id: this._host.machine.id,
        ip: this._host.machine.ip
      }
    }
  }

  async libraries () {
    return {}
  }

  async pack (value) {
    return this.packPackage(value)
  }

  /**
   * Unpack a data node into a native data value
   *
   * @param  {Object} node A data node (either a data packet or data pointer)
   * @return {[type]}      [description]
   */
  async unpack (node) {
    return this.unpackPackage(node)
  }

  async packPackage (value) {
    let type
    if (value === null) type = 'null'
    else type = value.type || typeof value
    switch (type) {
      default: return {type, data: value}
    }
  }

  async unpackPackage (pkg) {
    const type = pkg.type
    switch (type) {
      default: return pkg.data
    }
  }

  async packPointer ({type, name, preview = null}) {
    let {context, host, machine} = this.location
    return {
      type,
      path: {
        value: {
          id: 'value-' + uuid(),
          name: name
        },
        context,
        host,
        machine
      },
      preview: preview
    }
  }

  async unpackPointer (pointer) {
    const path = pointer.path
    const what = {
      name: path.value.name
    }
    if (path.context.id === this.id) {
      // Get data from this context
      return this.resolve(what)
    } else if (path.host.id === this.host.id) {
      // Get a context on this host to provide data
      let context = await this.host.resolve(path.context.name)
      let packag = await context.provide(what)
      return this.unpack(packag)
    } else if (path.machine.id === this.host.machine.id) {
      // Make a HTTP request to context via another host on this machine
      return this.host.generateToken(path.host.id).then(token => {
        const url = `http://127.0.0.1:${path.host.port}/${path.context.name}!provide`
        const auth = 'Bearer ' + token
        return request({
          method: 'PUT',
          uri: url,
          headers: {
            Accept: 'application/json',
            Authorization: auth
          },
          body: what,
          json: true
        })
      }).then(packag => {
        return this.unpack(packag)
      })
    } else {
      // Currently, because access keys are not exchanged between machines, this
      // is not possible. It may be possible in the future.
      throw new Error('Inter-machine pointers are not yet supported')
    }
  }

  async resolve (what) {
    if (!what.name) throw new Error('No name in: ' + what)
    const value = this._variables[what.name]
    if (value === undefined) throw new Error('No such value: ' + what.name)
    return value
  }

  async provide (what) {
    const data = await this.resolve(what)
    return this.pack(data)
  }

  async compile (cell) {
    return cell
  }

  async execute (cell) {
    return cell
  }

  async evaluate (node) {
    switch (node.type) {
      case 'get': return this.evaluateGet(node)
      case 'call': return this.evaluateCall(node)
      default: return this.unpack(node)
    }
  }
}

Context.spec = {
  name: 'Context',
  client: 'ContextHttpClient'
}

module.exports = Context
