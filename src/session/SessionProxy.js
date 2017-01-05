const ComponentProxy = require('../component/ComponentProxy')

class SessionProxy extends ComponentProxy {

  execute (code, inputs) {
    return this.call('execute', code, inputs)
  }

}

module.exports = SessionProxy
