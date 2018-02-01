const body = require('body')
const cookie = require('cookie')
const crypto = require('crypto')
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

  constructor (host, address = '127.0.0.1', port = 2000, authorization = true) {
    this._host = host
    this._address = address
    this._port = port

    let auth = process.env.STENCILA_AUTHORIZATION
    if (auth === 'true') authorization = true
    else if (auth === 'false') authorization = false
    this._authorization = authorization

    this._server = null
    this._tickets = []
    this._tokens = []
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

    // Check authorization. Note that browsers do not send credentials (e.g. cookies)
    // in OPTIONS requests
    if (this._authorization && request.method !== 'OPTIONS') {
      // Check for ticket
      let ticket = uri.query['ticket']
      if(ticket) {
        // Check ticket is valid
        if (!this.ticketCheck(ticket)) return this.error403(request, response, ': invalid ticket : ' + ticket)
        else {
          // Set token cookie
          let token = this.tokenCreate()
          response.setHeader('Set-Cookie', `token=${token}; Path=/`)
        }
      } else {
        // Check for token
        let token = cookie.parse(request.headers.cookie || '').token
        if (!token | !this.tokenCheck(token)) return this.error403(request, response, ': invalid token : ' + token)
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

    // Check that origin URL is in whitelist
    if (origin) {
      let host = url.parse(origin).hostname
      let match = host.match(/^((127\.0\.0\.1)|(localhost)|(([^.]+\.)?stenci\.la))$/)
      if (!match) origin = null
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

    let endpoint = this.route(request.method, uri.pathname)
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
   * @return {array} - An array with first element being the method to call, 
   *                   and subsequent elements being the call arguments
   */
  route (verb, path) {
    if (verb === 'OPTIONS') return [this.options]

    if (path === '/') return [this.home]
    if (path === '/favicon.ico') return [this.statico, 'favicon.ico']
    if (path.substring(0, 8) === '/static/') return [this.statico, path.substring(8)]

    let matches = path.match(/^\/([^!$]+)((!|\$)([^?]+))?.*$/)
    if (matches) {
      let id = matches[1]
      let operator = matches[3]
      let method = matches[4]
      if (verb === 'POST' && id && !method) return [this.create, id]
      else if (verb === 'GET' && id && !method) return [this.get, id]
      else if (verb === 'GET' && id && operator === '$' && method) return [this.file, id, method]
      else if (verb === 'PUT' && id && operator === '!' && method) return [this.call, id, method]
      else if (verb === 'DELETE' && id && !method) return [this.delete, id]
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
   * Handle a request to create an instance
   */
  create (request, response, type, args) {
    return this._host.create(type, args).then(result => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result.id))
    })
  }

  /**
   * Handle a request to get an instance
   */
  get (request, response, id) {
    return this._host.get(id).then(instance => {
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
  call (request, response, id, method, args) {
    return this._host.call(id, method, args).then(result => {
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify(result))
    })
  }

  /**
   * Handle a request for a file from a Storer instance
   *
   * An alternative method for getting a file is to call the `readFile` method
   * e.g. `PUT fileStore1!readFile`. But that returns `application/json` content. 
   * This uses the `send` package to set `Content-Type`, `Last-Modified` and other headers properly.
   */
  file (request, response, id, path) {
    return this._host.file(id, path).then(path => {
      send(request, path).pipe(response)
    })
  }

  /**
   * Handle a request to delete an instance
   */
  delete (request, response, id) {
    return this._host.delete(id).then(() => {
      response.end()
    })
  }


  /**
   * Create a ticket (a single-use access token)
   * 
   * @return {string} A ticket
   */
  ticketCreate () {
    const ticket = crypto.randomBytes(12).toString('hex')
    this._tickets.push(ticket)
    return ticket
  }

  /**
   * Check that a ticket is valid. 
   * 
   * If it is, then it is removed from the list of tickets 
   * and `true` is returned. Otherwise, returns `false`
   *  
   * @param  {string} ticket The ticket to check
   * @return {boolean}       Is the ticket valid?
   */
  ticketCheck (ticket) {
    const index = this._tickets.indexOf(ticket)
    if (index > -1) {
      this._tickets.splice(index, 1)
      return true
    } else {
      return false
    }
  }

  /**
   * Create a URL with a ticket query parameter so users
   * can connect to this server
   * 
   * @return {string} A ticket
   */
  ticketedUrl () {
    let url = this.url 
    if (this._authorization) url += '/?ticket=' + this.ticketCreate()
    return url
  }

  /**
   * Create a token (a multiple-use access token)
   * 
   * @return {string} A token
   */
  tokenCreate () {
    const token = crypto.randomBytes(126).toString('hex')
    this._tokens.push(token)
    return token
  }

  /**
   * Check that a token is valid.
   * 
   * @param  {string} token The token to check
   * @return {boolean}       Is the token valid?
   */
  tokenCheck (token) {
    return this._tokens.indexOf(token) > -1
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
        content = error.error + '\n\n' + error.details
      }
      response.end(content)
      resolve()
    })
  }

  /**
   * Specific error handling functions
   */

  error400 (request, response) {
    return this.error(request, response, 400, {error: 'Bad request', details: request.method + ' ' + request.url})
  }

  error403 (request, response, details) {
    return this.error(request, response, 403, {error: 'Access denied', details: details})
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
