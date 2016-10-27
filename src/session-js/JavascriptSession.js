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
    eval(code)
  }

  print (expr) {
    return eval(expr).toString()
  }

}

module.exports = JavascriptSession
