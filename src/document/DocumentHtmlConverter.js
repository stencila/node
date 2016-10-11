const cheerio = require('cheerio')
const beautify = require('js-beautify')

const ComponentConverter = require('../component/ComponentConverter')

class DocumentHtmlConverter extends ComponentConverter {

  load (document, content, format, options) {
    document.content = cheerio.load(content)
  }

  dump (document, format, options) {
    let html = document.content.html()
    // See beautification options at https://github.com/beautify-web/js-beautify/blob/master/js/lib/beautify-html.js
    html = beautify.html(html)
    return html
  }

}

module.exports = DocumentHtmlConverter
