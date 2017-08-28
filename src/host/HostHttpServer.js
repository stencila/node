const body = require('body')
const http = require('http')
const path = require('path')
const send = require('send')
const url = require('url')

const pathIsInside = require('path-is-inside')
const httpShutdown = require('http-shutdown')

const isSuperUser = require('../util/isSuperUser')

/**
 * A HTTP server for a `Host`
 */
class HostHttpServer {

  constructor (host, address = '127.0.0.1', port = 2000) {
    this._host = host
    this._address = address
    this._port = port
    this._server = null
  }

  /**
   * Get the URL of this server
   *   
   * @return {string} - Server's URL, `null` if not serving
   */
  get url () {
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

      // CORS headers are used to control access by browsers. In particular, CORS
      // can prevent access by XHR requests made by Javascript in third party sites.
      // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS

      // Get the Origin header (sent in CORS and POST requests) and fall back to Referer header
      // if it is not present (either of these should be present in most browser requests)
      let origin = request.headers.origin
      if (!origin && request.headers.referer) {
        let uri = url.parse(request.headers.referer || '')
        origin = `${uri.protocol}//${uri.host}`
      }

      // If an origin has been found and is authorized set CORS headers
      // Without these headers browser XHR request get an error like:
      //     No 'Access-Control-Allow-Origin' header is present on the requested resource.
      //     Origin 'http://evil.hackers:4000' is therefore not allowed access.
      if (origin) {
        // 'Simple' requests (GET and POST XHR requests)
        response.setHeader('Access-Control-Allow-Origin', origin)
          // Allow sending cookies and other credentials
        response.setHeader('Access-Control-Allow-Credentials', 'true')
        // Pre-flighted requests by OPTIONS method (made before PUT, DELETE etc XHR requests and in other circumstances)
        // get additional CORS headers
        if (request.method === 'OPTIONS') {
          // Allowable methods and headers
          response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
          response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          // "how long the response to the preflight request can be cached for without sending another preflight request"
          response.setHeader('Access-Control-Max-Age', '86400') // 24 hours
        }
      }

      let method = endpoint[0]
      let params = endpoint.slice(1)
      return new Promise((resolve, reject) => {
        body(request, (err, body) => {
          if (err) reject(err)
          else resolve(body)
        })
      }).then(body => {
        let args = {}

        let query = url.parse(request.url, true).query
        let json = '{' + Object.keys(query).map(key => `"${key}":${query[key]}`).join(',') + '}'
        args = JSON.parse(json)

        if (body) args = Object.assign(args, JSON.parse(body))

        return method.call(this, request, response, ...params, args)
      }).catch(error => this.error500(request, response, error))
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
    if (verb === 'OPTIONS') return [this.options]

    if (path === '/') return [this.home]
    if (path === '/favicon.ico') return [this.statico, 'favicon.ico']
    if (path.substring(0, 8) === '/static/') return [this.statico, path.substring(8)]

    let matches = path.match(/^\/([^!]+)(!([^?]+))?.*$/)
    if (matches) {
      let address = matches[1]
      let method = matches[3]
      if (verb === 'POST' && address) return [this.create, address]
      else if (verb === 'GET' && address && !method) return [this.get, address]
      else if ((verb === 'PUT' || verb === 'GET') && address && method) return [this.call, address, method]
      else if (verb === 'DELETE' && address && !method) return [this.delete, address]
    }

    return null
  }

  /**
   * Handle an OPTIONS request
   *
   * Necessary for preflighted CORS requests (https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS#Preflighted_requests)
   */
  options (request, response) {
    return Promise.resolve(response.end())
  }

  /**
   * Handle a request to `home`
   */
  home (request, response) {
    if (!acceptsJson(request)) {
      return this.statico(request, response, 'index.html')
    } else {
      return Promise.resolve().then(() => {
        let manifest = this._host.manifest()
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(manifest))
      })
    }
  }

  /**
   * Handle a request for a static file
   */
  statico (request, response, path_) {
    let staticPath = path.join(__dirname, '../../static')
    let requestedPath = path.join(staticPath, url.parse(path_).pathname)
    if (!pathIsInside(requestedPath, staticPath)) this.error403(request, response, path_)
    else send(request, requestedPath).pipe(response)
    return Promise.resolve()
  }

  /**
   * Handle a request to create an instance
   */
  create (request, response, type, args) {
    return this._host.create(type, args).then(result => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result.address))
    })
  }

  /**
   * Handle a request to get an instance
   */
  get (request, response, address) {
    return this._host.get(address).then(instance => {
      if (!acceptsJson(request) && instance.constructor && instance.constructor.page) {
        return this.statico(request, response, instance.constructor.page)
      } else {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(instance))
      }
    })
  }

  /**
   * Handle a request to call an instance method
   */
  call (request, response, address, method, args) {
    return this._host.call(address, method, args).then(result => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result))
    })
  }

  /**
   * Handle a request for a file from a Storer instance
   */
  file (request, response, address, path) {
    return this._host.file(address, path).then(path => {
      send(request, path).pipe(response)
    })
  }

  /**
   * Handle a request to delete an instance
   */
  delete (request, response, address) {
    return this._host.delete(address).then(() => {
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

  /**
   * Specific error handling functions
   */

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
    this.error(request, response, 500, {error: 'Internal error', details: error ? error.stack : ''})
  }

}

function acceptsJson (request) {
  let accept = request.headers['accept'] || ''
  return accept.match(/application\/json/)
}

module.exports = HostHttpServer
