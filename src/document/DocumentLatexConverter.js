const ComponentConverter = require('../component/ComponentConverter')
const pandoc = require('../helpers/pandoc')

class DocumentLatexConverter extends ComponentConverter {

  load (document, content, format, options) {
    options = options || {}
    let html = pandoc.convert(content, 'latex', 'html')
    document.load(html, 'html')
  }

  dump (document, format, options) {
    options = options || {}
    let html = document.dump('html')
    return pandoc.convert(html, 'html', 'latex', {
      'wrap': options.wrap || 'preserve',
      'columns': options.columns || 100
    })
  }

}

module.exports = DocumentLatexConverter
