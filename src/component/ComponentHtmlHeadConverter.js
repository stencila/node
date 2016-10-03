const ComponentConverter = require('./ComponentConverter')

class ComponentHtmlHeadConverter extends ComponentConverter {

  dump (component, format, options) {
    return `<title>${component.title || component.address}</title>\n` +
          `<meta name="id" content="${component.id}">\n` +
          (component.address ? `<meta name="address" content="${component.address}">\n` : '') +
          (component.description ? `<meta name="description" content="${component.description}">\n` : '') +
          (component.keywords ? `<meta name="keywords" content="${component.keywords.join(', ')}">\n` : '')
  }

}

module.exports = ComponentHtmlHeadConverter
