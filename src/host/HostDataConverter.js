const ComponentDataConverter = require('../component/ComponentDataConverter')

class HostDataConverter extends ComponentDataConverter {

  dump (host, format, options) {
    let data = super.dump(host)
    data.components = host.components.map(function (component) {
      return component.dump('data')
    })
    data.schemes = host.schemes
    data.formats = host.formats
    data.peers = host.peers
    return data
  }

}

module.exports = HostDataConverter
