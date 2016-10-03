const cheerio = require('cheerio')

const Component = require('../component/Component')
const DocumentDataConverter = require('./DocumentDataConverter')
const DocumentHtmlConverter = require('./DocumentHtmlConverter')

class Document extends Component {

  constructor (address, path) {
    super(address, path)

    this.content = cheerio.load('')

    if (path) this.read(path)
  }

  static open (address, path) {
    return new Document(address, path)
  }

  converter (format) {
    if (format === 'data') {
      return new DocumentDataConverter()
    } else if (format === 'html') {
      return new DocumentHtmlConverter()
    } else {
      return super.converter(format)
    }
  }

  select (selector) {
    return this.content(selector)
  }

}

module.exports = Document
