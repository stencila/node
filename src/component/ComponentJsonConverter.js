const ComponentConverter = require('./ComponentConverter')

class ComponentJsonConverter extends ComponentConverter {

  dump (component, format, options) {
    return JSON.stringify(component.dump('data'))
  }

}

module.exports = ComponentJsonConverter
