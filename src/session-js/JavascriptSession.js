const Session = require('../session/Session')

class JavascriptSession extends Session {

  get type () {
    return 'session-js'
  }

  get (name) {
    return this[name]
  }

  set (name, value) {
    this[name] = value
  }

  execute (code) {
    eval(code) // eslint-disable-line no-eval
  }

  print (expr) {
    return eval(expr).toString() // eslint-disable-line no-eval
  }

}

module.exports = JavascriptSession
