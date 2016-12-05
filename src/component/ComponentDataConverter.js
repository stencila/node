const ComponentConverter = require('./ComponentConverter')

class ComponentDataConverter extends ComponentConverter {

  dump (component, format, options) {
    return {
      'type': component.type,
      'kind': component.kind,
      'id': component.id,
      'short': component.short(),
      'address': component.address,
      'url': component.url
    }
  }

}

module.exports = ComponentDataConverter
