const JsSessionImplementation = require('stencila-js').JsSession

const Session = require('../session/Session')

class JsSession extends Session {

  constructor () {
    super()
    this.impl = new JsSessionImplementation()
  }

  static get type () {
    return 'js-session'
  }

  execute (code, inputs) {
    return this.impl.execute(code, inputs)
  }

}

module.exports = JsSession
