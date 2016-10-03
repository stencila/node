const Component = require('../component/Component')
const Document = require('../document/Document')
const Sheet = require('../sheet/Sheet')
const JsSession = require('../js-session/JsSession')
const HttpServer = require('../servers/HttpServer')

class Controller extends Component {

  constructor () {
    super()

    if (!Component.controller) {
      Component.controller = this
    }

    this._components = []

    this._servers = {}
  }

  know (address) {
    /*
    let {scheme, path, version} = this.split(address)
    if (scheme === 'new') {
      if (path in ('document', 'sheet', 'session', 'py-session', 'context')) {
        return 'yes'
      }
    }
    elif scheme == 'mem':
        return 'yes'
    else:
        if scheme in ('file', 'http', 'https', 'git'):
            for cls in [Document, Sheet, Frame, Session, Box]:
                answer = cls.know(path)
                if answer == 'yes':
                    return 'yes'
            return 'maybe'
    return 'no'
    */
  }

  get components () {
    return this._components
  }

  register (component) {
    this._components.push(component)
  }

  open (address) {
    if (address === null) {
      return this
    }

    let {scheme, path, version} = this.split(address) // eslint-disable-line no-unused-vars

    if (scheme === 'new') {
      if (path === 'document') {
        return new Document()
      } else if (path === 'sheet') {
        return new Sheet()
      } else if (path === 'jssession') {
        return new JsSession()
      } else {
        throw Error('Unable to create new component of type\n  address: %s\n  type: %s' % (address, path))
      }
    }

    for (let index in this._components) {
      let component = this._components[index]
      if (scheme === 'id') {
        if (component.id === path) {
          return component
        }
      } else {
        if (component.address === scheme + '://' + path) {
          return component
        }
      }
    }
  }

  serve () {
    if (!this.servers.http) {
      var server = new HttpServer(this)
      server.serve()
      this.servers.http = server
    }
  }

  get servers () {
    return this._servers
  }

  get url () {
    return this._servers.htpp ? this._servers.http.url : null
  }

}

var controller = new Controller() // eslint-disable-line no-unused-vars

module.exports = Controller
