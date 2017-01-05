const fs = require('fs')
const http = require('http')
const httpShutdown = require('http-shutdown')
const pathm = require('path')
const url = require('url')

const Component = require('../component/Component')

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
        return new Promise((resolve, reject) => {
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
        })
      }
    } else {
      if (this._server) {
        return new Promise((resolve, reject) => {
          this._server.shutdown(function () {
            console.log('HTTP server has been shutdown')
          })
          this._server = null
        })
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

  /**
   * Respond to a request for a file from the `web` package
   *
   * Stencila's `web` package (https://github.com/stencila/web) contains the
   * the browser based user interfaces for Stencila components. This method
   * serves up those interface files (Javascript, CSS, fonts etc) from alternative locations
   * based on the `STENCILA_WEB` environment variable
   *
   * - a local build of the `web` package (set STENCILA_WEB to the path of the build)
   * - a locally running `web` package development server (set STENCILA_WEB to the port number)
   * - a remote server or CDN (STENCILA_WEB not set)
   *
   * When being served from a local build, any queries (e.g. ?v=1.2.3) or hashes (e.g. #id)
   * are ignored.
   *
   * @param  {Request} request  Request object
   * @param  {Response} response Response object
   * @param  {String} path     Path to requested file
   */
  web (request, response, path) {
    let source = process.env.STENCILA_WEB || 'CDN'
    if (source === 'CDN') {
      response.writeHead(302, {'Location': `https://unpkg.com/stencila-web/build/${path}`})
      response.end()
    } else if (source.match(/\d+/)) {
      response.writeHead(302, {'Location': `http://127.0.0.1:${source}/web/${path}`})
      response.end()
    } else {
      let pathname = url.parse(path).pathname
      fs.readFile(pathm.join(source, pathname), (error, content) => {
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
  }

  /**
   * Get a property of a component
   *
   * The property is returned as a JSON string.
   *
   * If no component is found at the address, or if the component does not have a
   * property with the name, a HTTP `404 Not Found` response is returned
   *
   * Access to "private" properties, those whose name begins with a leading underscore,
   * is denied (HTTP `403 Forbidden` response).
   *
   * @param  {[type]} request  [description]
   * @param  {[type]} response [description]
   * @param  {[type]} address  [description]
   * @param  {[type]} name     [description]
   */
  get (request, response, address, name) {
    this._host.open(address).then(component => {
      if (!component) return this.error404(request, response, address)
      if (name[0] === '_') return this.error403(request, response, name)
      let result = component[name]
      if (typeof result === 'undefined') return this.error404(request, response, name)

      response.setHeader('Content-Type', 'application/json')
      response.end(stringify(result))
    }).catch(error => this.error500(request, response, error))
  }

  set (request, response, address, name) {
    bodify(request).then(body => {
      this._host.open(address).then(component => {
        if (!component) return this.error404(request, response, address)
        if (name[0] === '_') return this.error403(request, response, name)

        if (body) {
          let value = JSON.parse(body)
          component[name] = value
        }
        response.end()
      }).catch(error => this.error500(request, response, error))
    })
  }

  call (request, response, address, name) {
    bodify(request).then(body => {
      this._host.open(address).then(component => {
        if (!component) return this.error404(request, response, address)
        if (name[0] === '_') return this.error403(request, response, name)
        let method = component[name]
        if (typeof method === 'undefined') return this.error404(request, response, name)

        let result
        if (body) {
          let args = JSON.parse(body)
          if (args instanceof Array) {
            result = method.call(component, ...args)
          } else if (args instanceof Object) {
            // Convert object to an array
            args = Object.keys(args).map(key => args[key])
            result = method.call(component, ...args)
          } else {
            result = method.call(component, args)
          }
        } else {
          result = method.call(component)
        }
        // Some method call's may be synchronous, others may be promises.
        // Use Promise.resolve so that all method call results can be
        // treated as promises.
        Promise.resolve(result).then(result => {
          response.setHeader('Content-Type', 'application/json')
          response.end(stringify(result))
        })
      }).catch(error => {
        this.error500(request, response, error)
      })
    })
  }

  /**
   * Show a component
   *
   * Is the address scheme is `new` and the request is for HTML
   * content then the requester is redireted to the URL of the new
   * component. This prevents new components being created on each refresh
   * of a browser window.
   *
   * @param  {[type]} request  [description]
   * @param  {[type]} response [description]
   * @param  {[type]} address  [description]
   */
  show (request, response, address) {
    let {scheme} = this._host.split(address)
    this._host.open(address).then(component => {
      if (component) {
        if (acceptsJson(request)) {
          response.setHeader('Content-Type', 'application/json')
          response.end(component.show('json'))
        } else {
          if (scheme === 'new') {
            response.statusCode = 302
            response.setHeader('Location', component.url)
            response.end()
          } else {
            response.setHeader('Content-Type', 'text/html')
            response.end(component.show('html'))
          }
        }
      } else {
        this.error404(request, response)
      }
    }).catch(error => {
      this.error500(request, response, error)
    })
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
  return new Promise((resolve, reject) => {
    var body = []
    request.on('data', function (chunk) {
      body.push(chunk)
    }).on('end', function () {
      body = Buffer.concat(body).toString()
      resolve(body)
    })
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

module.exports = HostHttpServer
