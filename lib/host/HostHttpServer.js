const assert = require('assert')
const body = require('body')
const http = require('http')
const path = require('path')
const send = require('send')
const url = require('url')

const pathIsInside = require('path-is-inside')
const httpShutdown = require('http-shutdown')

/**
 * A HTTP server for a `Host`
 */
class HostHttpServer {
  constructor (host, address = '127.0.0.1', port = 2000) {
    assert(host && host.constructor.name === 'Host', 'host must be an instance of Host')

    this._host = host
    this._address = address
    this._port = port
    this._server = null
  }

  get address () {
    return this._address
  }

  get port () {
    return this._port
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
        if (require('../host/Host').isSuperUser()) {
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
    let uri = url.parse(request.url, true)

    // Get token from Authorization header (if any)
    let authorized = false
    if (process.env.STENCILA_AUTH === 'false') {
      authorized = true
    } else {
      const authHeader = request.headers.authorization
      if (authHeader) {
        const parts = authHeader.split(' ')
        if (parts[0] === 'Bearer') {
          let token = parts[1]
          try {
            authorized = this._host.authorizeToken(token)
          } catch (error) {
            return this.error403(request, response, error.message)
          }
        }
      }
    }

    // Add CORS headers used to control access by browsers. In particular, CORS
    // can prevent access by XHR requests made by Javascript in third party sites.
    // See https://developer.mozilla.org/en-US/docs/Web/HTTP/Access_control_CORS

    // Get the Origin header (sent in CORS and POST requests) and fall back to Referer header
    // if it is not present (either of these should be present in most browser requests)
    let origin = request.headers.origin
    if (!origin && request.headers.referer) {
      let uri = url.parse(request.headers.referer || '')
      origin = `${uri.protocol}//${uri.host}`
    }

    // Check that origin is in whitelist of file://, http://127.0.0.1, http://localhost, or http://*.stenci.la
    // The origin 'file://' is sent when a connection is made from Electron (i.e Stencila Desktop)
    if (origin) {
      if (origin !== 'file://') {
        let host = url.parse(origin).hostname
        let match = host.match(/^((127\.0\.0\.1)|(localhost)|(([^.]+\.)?stenci\.la))$/)
        if (!match) origin = null
      }
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
        // According to MDN "The simple headers, Accept, Accept-Language, Content-Language, Content-Type are always available and
        // don't need to be listed by this header." but I found it was necessary
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        // "how long the response to the preflight request can be cached for without sending another preflight request"
        response.setHeader('Access-Control-Max-Age', '86400') // 24 hours
      }
    }

    // console.log(request.method, uri.pathname, authorized)

    let endpoint = this.route(request.method, uri.pathname, authorized)
    if (endpoint) {
      return new Promise((resolve, reject) => {
        // Handle mock requests used during testing
        if (request._setBody) resolve(JSON.stringify(request.body))
        else {
          body(request, (err, body) => {
            if (err) reject(err)
            else resolve(body)
          })
        }
      }).then(body => {
        let method = endpoint[0]
        let params = endpoint.slice(1)
        let args = body ? JSON.parse(body) : {}
        return method.call(this, request, response, ...params, args)
      }).catch(error => {
        this.error500(request, response, error)
      })
    } else {
      return this.error400(request, response)
    }
  }

  /**
   * Route a HTTP request
   *
   * @param {string} verb - The request's HTTP verb (aka. "method") eg. GET
   * @param {string} path - The requested path
   * @param {Boolean} authorized - Is the request authorized
   * @return {array} - An array with first element being the method to call,
   *                   and subsequent elements being the call arguments
   */
  route (verb, path, authorized) {
    // Public endpoints

    if (verb === 'OPTIONS') return [this.options]
    if (path === '/') return [this.home]
    if (path.substring(0, 8) === '/static/') return [this.statico, path.substring(8)]
    if (path === '/manifest') return [this.manifest]

    // Private endpoints for which authorization is necessary

    if (!authorized) return [this.error403, `Authorization is required for ${verb} ${path}`]

    let matches = path.match(/^\/([^!$]+)((!|\$)([^?]+))?.*$/)
    if (matches) {
      let id = matches[1]
      let operator = matches[3]
      let method = matches[4]
      if (verb === 'POST' && id && !method) {
        if (id.substring(0, 8) === 'environ/') return [this.startup, id.substring(8)]
        else return [this.create, id]
      } else if (verb === 'GET' && id && !method) {
        return [this.get, id]
      } else if (verb === 'PUT' && id && operator === '!' && method) {
        return [this.call, id, method]
      } else if (verb === 'DELETE' && id && !method) {
        if (id.substring(0, 8) === 'environ/') return [this.shutdown, id.substring(8)]
        else return [this.delete, id]
      }
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
    return this.statico(request, response, 'index.html')
  }

  /**
   * Handle a request for a static file
   */
  statico (request, response, path_) {
    return new Promise((resolve) => {
      let staticPath = path.join(__dirname, '../../static')
      let requestedPath = path.join(staticPath, url.parse(path_).pathname)
      if (!pathIsInside(requestedPath, staticPath)) {
        this.error403(request, response, path_)
        resolve()
      } else {
        send(request, requestedPath)
          .on('error', (err) => {
            if (err.status === 404) this.error404(request, response, path_)
            else this.error500(request, response, path_)
            resolve()
          })
          .on('end', resolve)
          .pipe(response)
      }
    })
  }

  /**
   * Handle a request to `manifest`
   */
  manifest (request, response) {
    this._host.manifest().then(manifest => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(manifest))
    })
  }

  /**
   * Handle a request to startup an environment
   */
  startup (request, response, type, args) {
    return this._host.startup(type, args).then(result => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result))
    })
  }

  /**
   * Handle a request to create an instance
   */
  create (request, response, type, args) {
    return this._host.create(type, args).then(result => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result.name))
    })
  }

  /**
   * Handle a request to get an instance
   */
  get (request, response, name) {
    return this._host.get(name).then(repr => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(repr))
    })
  }

  /**
   * Handle a request to call an instance method
   */
  call (request, response, name, method, args) {
    return this._host.call(name, method, args).then(result => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result))
    })
  }

  /**
   * Handle a request to delete an instance
   */
  delete (request, response, name) {
    return this._host.delete(name).then(() => {
      response.end()
    })
  }

  /**
   * Handle a request to shutdown an environment
   */
  shutdown (request, response, type, args) {
    return this._host.shutdown(type, args).then(result => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result))
    })
  }

  /**
   * General error handling
   */
  error (request, response, status, error) {
    return new Promise((resolve) => {
      response.statusCode = status
      let content
      if (acceptsJson(request)) {
        response.setHeader('Content-Type', 'application/json')
        content = JSON.stringify(error)
      } else {
        content = error.error + ': ' + error.details
      }
      response.end(content)
      resolve()
    })
  }

  /**
   * Specific error handling functions
   */

  error400 (request, response, details) {
    details = details || (request.method + ' ' + request.url)
    return this.error(request, response, 400, {error: 'Bad request', details: details})
  }

  error403 (request, response, details) {
    return this.error(request, response, 403, {error: 'Forbidden', details: details})
  }

  error404 (request, response, details) {
    return this.error(request, response, 404, {error: 'Not found', details: details})
  }

  error500 (request, response, error) {
    /* istanbul ignore next */
    return this.error(request, response, 500, {error: 'Internal error', details: error ? error.stack : ''})
  }
}

function acceptsJson (request) {
  let accept = request.headers['accept'] || ''
  return accept.match(/application\/json/)
}

module.exports = HostHttpServer
