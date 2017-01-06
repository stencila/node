const fs = require('fs')
const tmp = require('tmp')

const ComponentConverter = require('../component/ComponentConverter')
const pandoc = require('../helpers/pandoc')

/**
 * Markdown converter for the `Document` class
 *
 * Uses Pandoc to convert to/from Markdown. Currently, Github Flavored Markdown
 * is assumed for loading and dumping.
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

    // Mapping of format to Pandoc reader
    format = {
      'md': 'markdown_github+yaml_metadata_block+implicit_figures'
    }[format || 'md'] || format

    // To extract the document's meta-data use a custom Pandoc template.
    // See
    //   http://pandoc.org/MANUAL.html#templates
    //   https://github.com/jgm/pandoc-templates/blob/master/default.html5
    // Note that `$abstract$` can be one or more paragraph if that is ow it is written in YAML
    let template = tmp.tmpNameSync({postfix: '.txt'})
    fs.writeFileSync(template, `$if(title)$
<h1 id="title">$title$</h1>
$endif$
$if(subtitle)$
<p id="subtitle">$subtitle$</p>
$endif$
$for(author)$
<p class="author">$author$</p>
$endfor$
$if(date)$
<p id="date">$date$</p>
$endif$
$if(abstract)$
<div id="summary">$abstract$</div>
$endif$
$if(toc)$
<nav id="toc">$toc$</nav>
$endif$
$body$`)

    let html = pandoc.convert(content, format, null, {
      'template': template,
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
