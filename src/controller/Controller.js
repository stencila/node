const Component = require('../component/Component')
const HttpServer = require('../servers/HttpServer')

class Controller extends Component {

  constructor () {
    super()

    if (!Component.controller) {
      Component.controller = this
    }

    this._servers = {}
  }

  get servers () {
    return this._servers
  }

  get url () {
    return 'http://127.0.0.1:2000'
  }

  serve () {
    if (!this.servers.http) {
      var server = new HttpServer()
      server.serve()
      this.servers.http = server
    }
  }

}

var controller = new Controller()

module.exports = Controller
