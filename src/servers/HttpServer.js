const http = require('http')
const httpShutdown = require('http-shutdown')

const Component = require('../component/Component')

class HttpServer {

  constructor (host, address, port) {
    this._host = host
    this._address = address || '127.0.0.1'
    this._port = port || 2000
    this._server = null
  }

  get address () {
    return this._address
  }

  get port () {
    return this._port
  }

  get url () {
    return 'http://' + this._address + ':' + this._port
  }

  get status () {
    return (this._server ? 'on' : 'off')
  }

  serve (on) {
    if (on === undefined) on = true

    if (on) {
      if (!this._server) {
        let server = http.createServer(this.handle.bind(this))
        server = httpShutdown(server)
        server.on('error', function (error) {
          if (error.code === 'EADDRINUSE') {
            this._port += 10
            server.close()
            server.listen(this._port, this._address)
            return
          }
          throw error
        }.bind(this))
        server.listen(this._port, this._address)
        this._server = server
      }
    } else {
      if (this._server) {
        this._server.shutdown(function () {
          console.log('HTTP server has been shutdown')
        })
        this._server = null
      }
    }
  }

  handle (request, response) {
    let endpoint = this.route(request.method, request.url)
    let method = endpoint[0]
    let args = endpoint.slice(1)
    try {
      method.call(this, request, response, ...args)
    } catch (error) {
      this.error500(request, response, error)
    }
  }

  route (method, path) {
    if (path === '/favicon.ico') {
      return [this.web, 'images/favicon.ico']
    }
    if (path.substring(0, 5) === '/web/') {
      return [this.web, path.substring(5)]
    }
    let matches = path.match(/^\/(.+?)?!(.+)$/)
    if (matches) {
      let address = matches[1] || null
      let name = matches[2]
      if (method === 'GET') {
        return [this.get, address, name]
      } else if (method === 'PUT') {
        return [this.set, address, name]
      } else if (method === 'POST') {
        return [this.call, address, name]
      }
    }
    return [this.show, path.substring(1) || null]
  }

  web (request, response, path) {
    response.statusCode = 302
    response.setHeader('Location', 'http://127.0.0.1:9000/web/' + path)
    response.end()
  }

  get (request, response, address, name) {
    let component = this._host.open(address)
    if (component) {
      let result = component[name]
      response.setHeader('Content-Type', 'application/json')
      response.end(stringify(result))
    } else {
      this.error404(request, response)
    }
  }

  set (request, response, address, name) {
    let self = this
    bodify(request, function (body) {
      try {
        if (body) {
          let component = self._host.open(address)
          let value = JSON.parse(body)
          component[name] = value
        }
        response.end()
      } catch (error) {
        self.error500(request, response, error)
      }
    })
  }

  call (request, response, address, name) {
    let self = this
    let component = self._host.open(address)
    bodify(request, function (body) {
      if (component) {
        let args
        if (body) {
          args = JSON.parse(body)
        } else {
          args = []
        }
        let method = component[name]
        if (!method) {
          throw Error(`Unknown method for component\n  address: ${address}\n  name: ${name}`)
        }
        let result = method.call(component, ...args)
        response.setHeader('Content-Type', 'application/json')
        response.end(stringify(result))
      } else {
        this.error404(request, response)
      }
    })
  }

  show (request, response, address) {
    let component = this._host.open(address)
    if (component) {
      let accept = request.headers['accept'] || ''
      if (accept.match(/application\/json/)) {
        response.setHeader('Content-Type', 'application/json')
        response.end(component.show('json'))
      } else {
        response.setHeader('Content-Type', 'text/html')
        response.end(component.show('html'))
      }
    } else {
      this.error404(request, response)
    }
  }

  error404 (request, response) {
    response.statusCode = 404
    response.end()
  }

  error500 (request, response, error) {
    response.statusCode = 500
    response.end(error.stack)
  }

}

function bodify (request, callback) {
  var body = []
  request.on('data', function (chunk) {
    body.push(chunk)
  }).on('end', function () {
    body = Buffer.concat(body).toString()
    callback(body)
  })
}

function stringify (object) {
  return JSON.stringify(object, function (key, value) {
    if (value instanceof Component) {
      return value.dump('data')
    } else {
      return value
    }
  })
}

module.exports = HttpServer
