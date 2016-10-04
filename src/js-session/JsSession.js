const Session = require('../session/Session')

class JsSession extends Session {

  get type () {
    return 'js-session'
  }

}

module.exports = JsSession
