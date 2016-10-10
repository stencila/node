const RemoteComponent = require('../component/RemoteComponent')

class RemoteHost extends RemoteComponent {

  open (address) {
    return this.call('open', address)
  }

}

module.exports = RemoteHost
