var he = require('he')

const ComponentConverter = require('./ComponentConverter')

class ComponentHtmlBodyConverter extends ComponentConverter {

  dump (component, format, options) {
    let data = component.dump('data')
    let json = he.encode(JSON.stringify(data))
    return `<script id="data" data-format="json" type="application/json">${json}</script>`
  }

}

module.exports = ComponentHtmlBodyConverter
