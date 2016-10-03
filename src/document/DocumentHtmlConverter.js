const cheerio = require('cheerio')

const ComponentConverter = require('../component/ComponentConverter')

class DocumentHtmlConverter extends ComponentConverter {

  load (document, content, format, options) {
    document.content = cheerio.load(content)
  }

  dump (document, format, options) {
    return document.content.html()
  }

}

module.exports = DocumentHtmlConverter
