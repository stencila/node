const ComponentConverter = require('../component/ComponentConverter')
const pandoc = require('../helpers/pandoc')

/**
 * Markdown converter for the `Document` class
 *
 * Uses Pandoc to convert to/from the Commonmark (http://commonmark.org/)
 * specification of Markdown.
 */
class DocumentMarkdownConverter extends ComponentConverter {

  /**
   * Load a document from Markdown
   *
   * @param  {Document} document Document to load
   * @param  {[type]} content  Markdown content
   * @param  {[type]} format   Format (usually `md`)
   * @param  {[type]} options  Any options (see implementations for those available)
   */
  load (document, content, format, options) {
    options = options || {}
    let html = pandoc.convert(content, 'commonmark', 'html', {
      'no-highlight': null
    })
    document.load(html, 'html')
  }

  /**
   * Dump a document to Markdown
   *
   * Leading and trailing whiestpace, including newlines, are trimmed
   *
   * @param  {Document} document Document to dump
   * @param  {String} format   Format ( usually `md`)
   * @param  {Object} options  Any options (see implementations for those available)
   * @return {String}          Content of the document as Commonmark
   */
  dump (document, format, options) {
    options = options || {}
    let html = document.dump('html')
    return pandoc.convert(html, 'html', 'commonmark', {
      'wrap': options.wrap || 'preserve',
      'columns': options.columns || 100
    }).trim()
  }

}

module.exports = DocumentMarkdownConverter
