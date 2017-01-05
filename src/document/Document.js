const cheerio = require('cheerio')
const $ = cheerio
const includes = require('lodash/includes')

const Component = require('../component/Component')
const DocumentDataConverter = require('./DocumentDataConverter')
const DocumentHtmlHeadConverter = require('./DocumentHtmlHeadConverter')
const DocumentHtmlBodyConverter = require('./DocumentHtmlBodyConverter')
const DocumentHtmlConverter = require('./DocumentHtmlConverter')
const DocumentLatexConverter = require('./DocumentLatexConverter')
const DocumentMarkdownConverter = require('./DocumentMarkdownConverter')
const DocumentXMarkdownConverter = require('./DocumentXMarkdownConverter')
const JsSession = require('../js-session/JsSession')

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

    /**
     * A list of sessions used by this document for
     * rendering directives
     *
     * @member {Array<Session>}
     */
    this.sessions = []

    if (path) this.read(path)
  }

  /**
   * Get the `Document` converter for a format
   *
   * @override
   * @param {string} format The format needing conversion
   * @return {ComponentConverter} A converter object
   */
  static converter (format) {
    if (format === 'data') {
      return new DocumentDataConverter()
    } else if (format === 'html-head') {
      return new DocumentHtmlHeadConverter()
    } else if (format === 'html-body') {
      return new DocumentHtmlBodyConverter()
    } else if (format === 'html') {
      return new DocumentHtmlConverter()
    } else if (includes(['md', 'gfmd'], format)) {
      return new DocumentMarkdownConverter()
    } else if (includes(['jsmd', 'pymd', 'rmd'], format)) {
      return new DocumentXMarkdownConverter()
    } else if (format === 'latex') {
      return new DocumentLatexConverter()
    } else {
      return super.converter(format)
    }
  }

  get md () {
    return this.dump('md')
  }

  set md (content) {
    return this.load(content, 'md')
  }

  get latex () {
    return this.dump('latex')
  }

  set latex (content) {
    return this.load(content, 'latex')
  }

  /**
   * Select
   *
   * @param      {string}  selector  The selector
   * @return     {Array<DOMNodes>}  An array of cheerio DOM nodes
   */
  select (selector) {
    return this.content(selector)
  }

  /**
   * Render the document
   *
   * - if no session then create one when hit first exec directive
   * - if hit a print or any other directive that needs evaluation first then error
   * - other exec directives should spawn in the root session
   *
   * @return {Document} This document
   */
  render () {
    // This is just a example implementation
    // Need to have methods or classes that deal with each directive.
    // Maybe another repo that can be shared
    let prints = this.select('[data-print]')
    let self = this
    prints.each(function (index, elem) {
      let print = $(this)
      let expr = print.attr('data-print')
      if (!self.session) {
        self.session = new JsSession()
      }
      let text = self.session.print(expr)
      print.text(text)
    })
    return this
  }

}

module.exports = Document
