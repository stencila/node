const Session = require('../session/Session')

class JavascriptSession extends Session {

  get type () {
    return 'js-session'
  }

  get (name) {
    return this[name]
  }

  set (name, value) {
    this[name] = value
  }

  execute (code) {
    eval(code) // eslint-disable-line no-eval
    return {
      errors: null,
      output: {
        format: 'json',
        content: ''
      },
      pipes: []
    }
  }

  print (expr) {
    return eval(expr).toString() // eslint-disable-line no-eval
  }

}

module.exports = JavascriptSession
