const fs = require('fs')
const http = require('http')
const pathm = require('path')
const url = require('url')

const httpShutdown = require('http-shutdown')

/**
 * A HTTP server for a `Host`
 */
class HostHttpServer {

  constructor (host, address, port) {
    this._host = host
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

  start () {
    return new Promise((resolve, reject) => {
      if (!this._server) {
        let server = http.createServer(this.handle.bind(this))
        server = httpShutdown(server)
        server.on('error', function (error) {
          if (error.code === 'EADDRINUSE') {
            this._port += 10
            server.close()
            server.listen(this._port, this._address, 511, () => {
              resolve()
            })
            return
          }
          reject(error)
        }.bind(this))
        server.listen(this._port, this._address, 511, () => {
          resolve()
        })
        this._server = server
      }
      resolve()
    })
  }

  stop () {
    return new Promise((resolve) => {
      if (this._server) {
        this._server.shutdown(function () {
          console.log('HTTP server has been shutdown') // eslint-disable-line no-console
        })
        this._server = null
      }
      resolve()
    })
  }

  handle (request, response) {
    let endpoint = this.route(request.method, request.url)
    if (endpoint) {
      let method = endpoint[0]
      let args = endpoint.slice(1)
      try {
        method.call(this, request, response, ...args)
      } catch (error) {
        this.error500(request, response, error)
      }
    } else {
      this.error400(request, response)
    }
  }

  route (verb, path) {
    if (path === '/') return [this.home]
    if (path === '/favicon.ico') return [this.statico, 'favicon.ico']
    if (path.substring(0, 8) === '/static/') return [this.statico, path.substring(8)]

    let matches = path.match(/^\/(.+?)(!(.+))?$/)
    if (matches) {
      let id = matches[1]
      let method = matches[3]
      if (verb === 'POST' && id) return [this.post, id]
      else if (verb === 'GET' && id) return [this.get, id]
      else if (verb === 'PUT' && id && method) return [this.put, id, method]
      else if (verb === 'DELETE' && id) return [this.delete, id]
    }

    return null
  }

  home (request, response) {
    if (!acceptsJson(request)) {
      this.statico(request, response, 'dashboard.html')
    } else {
      this._host.options()
        .then(options => {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(options))
        })
        .catch(error => this.error500(request, response, error))
    }
  }

  statico (request, response, path) {
    fs.readFile('./static/' + url.parse(path).pathname, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          response.writeHead(404)
        } else {
          response.writeHead(500)
        }
        response.end()
      } else {
        let contentType = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpg',
          '.gif': 'image/gif',
          '.woff': 'application/font-woff',
          '.ttf': 'application/font-ttf',
          '.eot': 'application/vnd.ms-fontobject',
          '.otf': 'application/font-otf',
          '.svg': 'application/image/svg+xml'
        }[String(pathm.extname(path)).toLowerCase()] || 'application/octect-stream'
        response.writeHead(200, { 'Content-Type': contentType })
        response.end(content, 'utf-8')
      }
    })
  }

  post (request, response, service) {
    bodify(request).then(body => { // eslint-disable-line no-unused-vars
      this._host.post(service)
        .then(id => {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(id))
        })
        .catch(error => this.error500(request, response, error))
    })
  }

  get (request, response, id) {
    this._host.get(id)
      .then(instance => {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(instance))
      })
      .catch(error => this.error500(request, response, error))
  }

  put (request, response, id, method) {
    bodify(request).then(body => {
      // Ensure arguments are an array
      let args = []
      if (body) {
        let value = JSON.parse(body)
        if (value instanceof Array) {
          args = value
        } else if (value instanceof Object) {
          args = Object.keys(value).map(key => value[key])
        } else {
          args = [value]
        }
      }

      this._host.put(id, method, args)
        .then(result => {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(result))
        })
        .catch(error => this.error500(request, response, error))
    })
  }

  delete (request, response, id) {
    this._host.delete(id)
      .then(() => {
        response.end()
      })
      .catch(error => this.error500(request, response, error))
  }

  error400 (request, response) {
    response.statusCode = 400
    let what = request.method + ' ' + request.url
    let content
    if (acceptsJson(request)) {
      content = JSON.stringify({error: 'Bad request', what: what})
      response.setHeader('Content-Type', 'application/json')
    } else {
      content = 'Bad request: ' + what
    }
    response.end(content)
  }

  error403 (request, response, what) {
    response.statusCode = 403
    let content
    if (acceptsJson(request)) {
      content = JSON.stringify({error: 'Access denied', what: what})
      response.setHeader('Content-Type', 'application/json')
    } else {
      content = 'Access denied' + (what ? (': ' + what) : '')
    }
    response.end(content)
  }

  error404 (request, response, what) {
    response.statusCode = 404
    let content
    if (acceptsJson(request)) {
      content = JSON.stringify({error: 'Not found', what: what})
      response.setHeader('Content-Type', 'application/json')
    } else {
      content = 'Not found' + (what ? (': ' + what) : '')
    }
    response.end(content)
  }

  error500 (request, response, error) {
    response.statusCode = 500
    let content
    let what = error ? error.stack : ''
    if (acceptsJson(request)) {
      content = JSON.stringify({error: 'Internal error', what: what})
      response.setHeader('Content-Type', 'application/json')
    } else {
      content = 'Internal error' + (what ? (': ' + what) : '')
    }
    response.end(content)
  }

}

function acceptsJson (request) {
  let accept = request.headers['accept'] || ''
  return accept.match(/application\/json/)
}

function bodify (request) {
  return new Promise((resolve) => {
    var body = []
    request.on('data', function (chunk) {
      body.push(chunk)
    }).on('end', function () {
      body = Buffer.concat(body).toString() // eslint-disable-line no-undef
      resolve(body)
    })
  })
}

module.exports = HostHttpServer
