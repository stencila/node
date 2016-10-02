const http = require('http')
const httpShutdown = require('http-shutdown')

class HttpServer {

  get status () {
    return (this._server ? 'on' : 'off')
  }

  serve (on) {
    if (on === undefined) on = true

    if (on) {
      if (!this._server) {
        let server = http.createServer(this.handle.bind(this))
        server = httpShutdown(server)
        let port = 2000
        server.on('error', function (error) {
          if (error.code === 'EADDRINUSE' & port < 65535) {
            port += 10
            server.close()
            server.listen(port, '127.0.0.1')
            return
          }
          console.error(error.stack)
        })
        server.listen(port, '127.0.0.1')
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
    method.call(this, request, response, ...args)
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
    if (path === '/') {
      return [this.show, null]
    }
    let matches = path.match(/^\/(.+?)!(.+)$/)
    if (matches) {
      let address = matches[1]
      let name = matches[2]
      if (method === 'GET') {
        return [this.get, address, name]
      } else if (method === 'PUT') {
        return [this.set, address, name]
      } else if (method === 'POST') {
        return [this.call, address, name]
      }
    }
    return [this.show, path.substring(1)]
  }

  web (request, response, path) {
    response.statusCode = 302
    response.setHeader('Location', 'http://127.0.0.1:9000/web/' + path)
    response.end()
  }

  show (request, response, address) {
    response.end('TODO show')
  }

  get (request, response, address, name) {
    response.end('TODO get')
  }

  set (request, response, address, name) {
    var body = []
    request.on('data', function (chunk) {
      body.push(chunk)
    }).on('end', function () {
      body = Buffer.concat(body).toString()
      response.end('TODO set: ' + body)
    })
  }

  call (request, response, address, name) {
    response.end('TODO call')
  }

}

module.exports = HttpServer
