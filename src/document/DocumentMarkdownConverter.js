const ComponentConverter = require('../component/ComponentConverter')
const pandoc = require('../helpers/pandoc')

class DocumentMarkdownConverter extends ComponentConverter {

  load (document, content, format, options) {
    options = options || {}
    let html = pandoc.convert(content, 'commonmark', 'html', {
      'no-highlight': null
    })
    document.load(html, 'html')
  }

  dump (document, format, options) {
    options = options || {}
    let html = document.dump('html')
    return pandoc.convert(html, 'html', 'commonmark', {
      'wrap': options.wrap || 'preserve',
      'columns': options.columns || 100
    })
  }

}

module.exports = DocumentMarkdownConverter
