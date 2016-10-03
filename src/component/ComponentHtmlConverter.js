const ComponentConverter = require('./ComponentConverter')

class ComponentHtmlConverter extends ComponentConverter {

  dump (component, format, options) {
    return `<div data-type="${component.type}" data-id="${component.id}"></div>`
  }

}

module.exports = ComponentHtmlConverter
