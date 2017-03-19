const fs = require('fs')
const http = require('http')
const path = require('path')
const url = require('url')

const pathIsInside = require('path-is-inside')
const httpShutdown = require('http-shutdown')

const isSuperUser = require('../util/isSuperUser')

/**
 * A HTTP server for a `Host`
 */
class HostHttpServer {

  constructor (host, port = 2000) {
    this._host = host
    this._address = '127.0.0.1'
    this._port = port
    this._server = null
  }

  /**
   * Get the URL of this server
   *   
   * @return {string} - Server's URL, `null` if not serving
   */
  url () {
    return this._server ? ('http://' + this._address + ':' + this._port) : null
  }

  /**
   * Start this server
   * 
   * @return {Promise}
   */
  start () {
    return new Promise((resolve, reject) => {
      if (!this._server) {
        if (isSuperUser()) {
          return reject(new Error('Serving host as a super user is dangerous and is not allowed'))
        }

        let server = http.createServer(this.handle.bind(this))
        server = httpShutdown(server)
        server.on('error', error => {
          if (error.code === 'EADDRINUSE') {
            this._port += 10
            server.close()
            server.listen(this._port, this._address, 511)
          } else {
            reject(error)
          }
        })
        server.on('listening', () => {
          resolve()
        })
        server.listen(this._port, this._address, 511)
        this._server = server
      } else {
        resolve()
      }
    })
  }

  /**
   * Stop this server
   * 
   * @return {Promise}
   */
  stop () {
    return new Promise((resolve) => {
      if (this._server) {
        this._server.shutdown()
        this._server = null
      }
      resolve()
    })
  }

  /**
   * Handle a HTTP request
   */
  handle (request, response) {
    let endpoint = this.route(request.method, request.url)
    if (endpoint) {
      let method = endpoint[0]
      let args = endpoint.slice(1)
      return method.call(this, request, response, ...args)
                   .catch(error => this.error500(request, response, error))
    } else {
      this.error400(request, response)
      return Promise.resolve()
    }
  }

  /**
   * Route a HTTP request
   *
   * @param {string} verb - The request's HTTP verb (aka. "method") eg. GET
   * @param {string} path - The requested path
   * @return {array} - An array with first element being the method to call, 
   *                   and subsequent elements being the call arguments
   */
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

  /**
   * Handle a request to `home`
   */
  home (request, response) {
    if (!acceptsJson(request)) {
      return this.statico(request, response, 'index.html')
    } else {
      return this._host.options()
        .then(options => {
          response.setHeader('Content-Type', 'application/json')
          response.end(JSON.stringify(options))
        })
    }
  }

  /**
   * Handle a request a static file
   */
  statico (request, response, path_) {
    return new Promise((resolve) => {
      let staticPath = path.join(__dirname, '../../static')
      let requestedPath = path.join(staticPath, url.parse(path_).pathname)
      if (!pathIsInside(requestedPath, staticPath)) {
        this.error403(request, response, path_)
        resolve()
      } else {
        fs.readFile(requestedPath, (error, content) => {
          if (error) {
            if (error.code === 'ENOENT') {
              this.error404(request, response, path_)
            } else {
              this.error500(request, response, error)
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
              '.svg': 'image/svg+xml',

              '.woff': 'application/font-woff',
              '.ttf': 'application/font-ttf',
              '.eot': 'application/vnd.ms-fontobject',
              '.otf': 'application/font-otf'
            }[String(path.extname(path_)).toLowerCase()] || 'application/octect-stream'
            response.setHeader('Content-Type', contentType)
            response.end(content, 'utf-8')
          }
          resolve()
        })
      }
    })
  }

  /**
   * Handle a request to `post`
   */
  post (request, response, type) {
    return bodify(request)
      .then(body => {
        let options = body ? JSON.parse(body) : {}
        return this._host.post(type, options)
          .then(id => {
            response.setHeader('Content-Type', 'application/json')
            response.end(id)
          })
      })
  }

  /**
   * Handle a request to `get`
   */
  get (request, response, id) {
    return this._host.get(id)
      .then(instance => {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(instance))
      })
  }

  /**
   * Handle a request to `put`
   */
  put (request, response, id, method) {
    return bodify(request)
      .then(body => {
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
        return args
      })
      .then(args => {
        return this._host.put(id, method, args)
          .then(result => {
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(result))
          })
      })
  }

  /**
   * Handle a request to `delete`
   */
  delete (request, response, id) {
    return this._host.delete(id)
      .then(() => {
        response.end()
      })
  }

  /**
   * General error handling
   */
  error (request, response, status, error) {
    response.statusCode = status
    let content
    if (acceptsJson(request)) {
      response.setHeader('Content-Type', 'application/json')
      content = JSON.stringify(error)
    } else {
      content = error.error + '\n\n' + error.details
    }
    response.end(content)
  }

  error400 (request, response) {
    this.error(request, response, 400, {error: 'Bad request', details: request.method + ' ' + request.url})
  }

  error403 (request, response, details) {
    this.error(request, response, 403, {error: 'Access denied', details: details})
  }

  error404 (request, response, details) {
    this.error(request, response, 404, {error: 'Not found', details: details})
  }

  error500 (request, response, error) {
    /* istanbul ignore next */
    this.error(request, response, 500, {error: 'Not found', details: error ? error.stack : ''})
  }

}

function acceptsJson (request) {
  let accept = request.headers['accept'] || ''
  return accept.match(/application\/json/)
}

function bodify (request) {
  return new Promise((resolve) => {
    // Check if in tests and using a mock request
    if (request._setBody) resolve(request.body)
    else {
      // Ignore this for code coverage it's difficult to test
      /* istanbul ignore next */
      (function () {
        var body = []
        request.on('data', function (chunk) {
          body.push(chunk)
        }).on('end', function () {
          body = Buffer.concat(body).toString() // eslint-disable-line no-undef
          resolve(body)
        })
      }())
    }
  })
}

module.exports = HostHttpServer
