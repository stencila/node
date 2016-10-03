const ComponentConverter = require('./ComponentConverter')

class ComponentDataConverter extends ComponentConverter {

  dump (component, format, options) {
    return {
      'type': component.type,
      'id': component.id,
      'address': component.address
    }
  }

}

module.exports = ComponentDataConverter
