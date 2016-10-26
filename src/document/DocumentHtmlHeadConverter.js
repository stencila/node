const ComponentHtmlHeadConverter = require('../component/ComponentHtmlHeadConverter')

class DocumentHtmlHeadConverter extends ComponentHtmlHeadConverter {

  dump (document, format, options) {
    let meta = super.dump(document, format, options)
    if (document.session) meta += `<meta name="session" content="${document.session.url}">\n`
    return meta
  }

}

module.exports = DocumentHtmlHeadConverter
