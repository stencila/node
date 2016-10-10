const ComponentConverter = require('../component/ComponentConverter')

class DocumentHtmlBodyConverter extends ComponentConverter {

  dump (document, format, options) {
    return `<main id="data" data-format="html">${document.dump('html')}</main>`
  }

}

module.exports = DocumentHtmlBodyConverter
