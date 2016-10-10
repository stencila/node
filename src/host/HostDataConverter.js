const ComponentDataConverter = require('../component/ComponentDataConverter')

class HostDataConverter extends ComponentDataConverter {

  dump (host, format, options) {
    let data = super.dump(host)
    data.manifest = host.manifest()
    data.components = host.components.map(function (component) {
      return component.dump('data')
    })
    data.peers = host.peers
    return data
  }

}

module.exports = HostDataConverter
