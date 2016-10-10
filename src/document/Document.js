const cheerio = require('cheerio')

const Component = require('../component/Component')
const DocumentDataConverter = require('./DocumentDataConverter')
const DocumentHtmlBodyConverter = require('./DocumentHtmlBodyConverter')
const DocumentHtmlConverter = require('./DocumentHtmlConverter')
const DocumentMarkdownConverter = require('./DocumentMarkdownConverter')

/**
 * A document
 *
 * The `content` of a document is a Cheerio DOM node
 *
 * @class      Document
 */
class Document extends Component {

  /**
   * Constructs a document
   * 
   * If a `path` argument is supplied then the document
   * will be `read()` from it.
   *
   * @param      {string}  [address]  The address
   * @param      {string}  [path]     The path
   */
  constructor (address, path) {
    super(address, path)

    this.content = cheerio.load('')

    if (path) this.read(path)
  }

  // TODO does this need to be create and do check for is address has already been opened
  static open (address, path) {
    return new Document(address, path)
  }

  /**
   * Get the `Document` converter for a format
   *
   * @override
   * @param {string} format
   * @return {ComponentConverter} A converter object
   */
  converter (format) {
    if (format === 'data') {
      return new DocumentDataConverter()
    } else if (format === 'html-body') {
      return new DocumentHtmlBodyConverter()
    } else if (format === 'html') {
      return new DocumentHtmlConverter()
    } else if (format === 'md') {
      return new DocumentMarkdownConverter()
    } else {
      return super.converter(format)
    }
  }

  /**
   * Select
   *
   * @param      {<type>}  selector  The selector
   * @return     {<type>}  { description_of_the_return_value }
   */
  select (selector) {
    return this.content(selector)
  }

}

module.exports = Document
