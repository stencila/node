const cheerio = require('cheerio')
const $ = cheerio
const includes = require('lodash/includes')

const Component = require('../component/Component')
const DocumentDataConverter = require('./DocumentDataConverter')
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
 * `sessions` is a list of sessions used by this document for
 * rendering directives
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

  // Some metadata getters

  get title () {
    return this.select('#title').text()
  }

  get summary () {
    return this.select('#summary').text()
  }

  get authors () {
    let authors = []
    this.select('.author').each(function () {
      authors.push($(this).text())
    })
    return authors
  }

  get date () {
    return this.select('#date').text()
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

  /**
   * Generate a HTML page for this document
   *
   * This is an override to generate HTML data (rather than JSON data) for the
   * user interface Javascript (in package `web`)
   *
   * @override
   */
  page (options, part) {
    if (part === 'main') {
      return `<main id="data" data-format="html">
            <div class="content">${this.dump('html')}</div>
            <div class="sessions">${this.sessions.map(session => { return session.dump('html') }).join()}</div>
          </main>`
    } else {
      return super.page(options, part)
    }
  }

}

module.exports = Document
