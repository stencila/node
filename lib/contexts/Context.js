const uuid = require('uuid')
const request = require('request-promise')

class Context {
  constructor (host, name) {
    this._host = host
    this._id = `node-${this.constructor.name.toLowerCase()}-${uuid()}`
    this._name = name
    this._data = {}
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

  pack (value) {
    const type = value.type || typeof value
    switch (type) {
      default: return {type, data: value}
    }
  }

  packPointer (type, name) {
    return Promise.resolve({
      type,
      name,
      context: {
        id: this._id,
        name: this._name
      },
      host: {
        id: this._host.id,
        port: this._host.servers.http.port
      },
      machine: {
        mac: this._host.machine.mac,
        ip: this._host.machine.ip
      }
    })
  }

  /**
   * Unpack a data node into a native data value
   *
   * @param  {Object} node A data node (either a data packet or data pointer)
   * @return {[type]}      [description]
   */
  unpack (node) {
    const type = node.type
    switch (type) {
      default: return node.data
    }
  }

  unpackPointer (pointer) {
    return Promise.resolve().then(() => {
      if (pointer.context.id === this.id) {
        // Get data from this context
        return this.get(pointer.name)
      } else if (pointer.host.id === this.host.id) {
        // Get a context on this host to provide data
        return this.host.resolve(pointer.context.name).then(context => {
          return context.provide(pointer.name)
        }).then(packag => {
          return this.unpack(packag)
        })
      } else if (pointer.machine.ip === this.host.machine.ip || pointer.machine.mac === this.host.machine.mac) {
        // Make a HTTP request to context via another host on this machine
        return this.host.generateToken(pointer.host.id).then(token => {
          const url = `http://127.0.0.1:${pointer.host.port}/${pointer.context.name}!provide`
          const auth = 'Bearer ' + token
          return request({
            method: 'PUT',
            uri: url,
            headers: {
              Accept: 'application/json',
              Authorization: auth
            },
            body: {name: pointer.name},
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
    })
  }

  get (name) {
    return Promise.resolve(
      this._data[name]
    )
  }

  provide (name) {
    return this.get(name).then(data => {
      return this.pack(data)
    })
  }

  async compile (node) {
    return node
  }

  async execute (node) {
    const type = node.type
    switch (type) {
      case 'expr':
        return this.executeExpr(node)
      case 'block':
        return this.executeBlock(node)
      default:
        throw new Error('Unknown node type')
    }
  }

  async executeExpr (expr) {
    return expr
  }

  async executeBlock (block) {
    return block
  }
}

Context.spec = {
  name: 'Context',
  client: 'ContextHttpClient'
}

module.exports = Context
