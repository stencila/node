const http = require('http')
const httpShutdown = require('http-shutdown')

const Component = require('../component/Component')

class HttpServer {

  constructor (controller, address, port) {
    this._controller = controller
    this._address = address || '127.0.0.1'
    this._port = port || 2000
    this._server = null
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
          if (error.code === 'EADDRINUSE' & this._port < 65535) {
            this._port += 10
            server.close()
            server.listen(this._port, this._address)
            return
          }
          console.error(error.stack)
        })
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
    let methodArgs = this.route(request.method, request.url)
    let method = methodArgs[0]
    let args = methodArgs.slice(1)
    try {
      method.call(this, request, response, ...args)
    } catch (error) {
      this.error(request, response, error)
    }
  }

  route (method, path) {
    if (path === '/favicon.ico') {
      return [this.web, 'images/favicon.ico']
    }
    if (path.substring(0, 5) === '/web/') {
      return [this.web, path.substring(5)]
    }
    /*
    if (path === '/hello') {
      return (this.hello,)
    }
    */
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

  show (request, response, address) {
    let component = this._controller.open(address)
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
      response.statusCode = 404
      response.end()
    }
  }

  get (request, response, address, name) {
    let component = this._controller.open(address)
    if (component) {
      let result = component[name]
      response.setHeader('Content-Type', 'application/json')
      response.end(stringify(result))
    } else {
      response.statusCode = 404
      response.end()
    }
  }

  set (request, response, address, name) {
    let self = this
    bodify(request, function (body) {
      try {
        if (body) {
          let component = self._controller.open(address)
          let value = JSON.parse(body)
          component[name] = value
        }
        response.end()
      } catch (error) {
        self.error(request, response, error)
      }
    })
  }

  call (request, response, address, name) {
    response.end('TODO call')
  }

  error (request, response, error) {
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
