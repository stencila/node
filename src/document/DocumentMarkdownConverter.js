const ComponentConverter = require('../component/ComponentConverter')
const pandoc = require('../helpers/pandoc')

class DocumentMarkdownConverter extends ComponentConverter {

  load (document, content, format, options) {
    document.load(pandoc.convert(content, 'markdown', 'html'), 'html')
  }

  dump (document, format, options) {
    return pandoc.convert(document.dump('html'), 'html', 'markdown')
  }

}

module.exports = DocumentMarkdownConverter
