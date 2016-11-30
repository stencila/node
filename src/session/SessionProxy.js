const ComponentProxy = require('../component/ComponentProxy')

class SessionProxy extends ComponentProxy {

  execute (code) {
    return this.call('execute', code)
  }

  print (expr) {
    return this.call('print', expr)
  }

}

module.exports = SessionProxy
