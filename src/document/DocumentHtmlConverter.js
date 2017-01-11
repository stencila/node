const url = require('url')

const cheerio = require('cheerio')
const $ = cheerio
const beautify = require('js-beautify')

const version = require('../../package').version
const ComponentConverter = require('../component/ComponentConverter')

class DocumentHtmlConverter extends ComponentConverter {

  load (document, content, format, options) {
    document.content = cheerio.load(content)
  }

  dump (document, format, options) {
    options = options || {}

    // Need to clone content befor modiying
    // Couldn't get this to work with cheerio clone, so doing a (presumably
    // inefficient) dump and then load
    let dom = cheerio.load(document.content.html())

    // Append `?raw` to all image src URLs that are relative
    // Why? Because otherwise the Stencila Host will serve up the file as a Component page
    // instead of as a raw image.
    dom('img[src]').toArray().forEach(el => {
      el = $(el)
      let src = el.attr('src')
      let q = url.parse(src).query
      if (q) src += '&raw'
      else src += '?raw'
      el.attr('src', src)
    })

    let html = dom.html()

    // Beautification. See options at https://github.com/beautify-web/js-beautify/blob/master/js/lib/beautify-html.js
    //   indent_inner_html (default false)  — indent <head> and <body> sections,
    //   indent_size (default 4)          — indentation size,
    //   indent_char (default space)      — character to indent with,
    //   wrap_line_length (default 250)            -  maximum amount of characters per line (0 = disable)
    //   brace_style (default "collapse") - "collapse" | "expand" | "end-expand" | "none"
    //           put braces on the same line as control statements (default), or put braces on own line (Allman / ANSI style), or just put end braces on own line, or attempt to keep them where they are.
    //   unformatted (defaults to inline tags) - list of tags, that shouldn't be reformatted
    //   content_unformatted (defaults to pre tag) - list of tags, that its content shouldn't be reformatted
    //   indent_scripts (default normal)  - "keep"|"separate"|"normal"
    //   preserve_newlines (default true) - whether existing line breaks before elements should be preserved
    //                                       Only works before elements, not inside tags or for text.
    //   max_preserve_newlines (default unlimited) - maximum number of line breaks to be preserved in one chunk
    //   indent_handlebars (default false) - format and indent {{#foo}} and {{/foo}}
    //   end_with_newline (false)          - end with a newline
    //   extra_liners (default [head,body,/html]) -List of tags that should have an extra newline before them.
    html = beautify.html(html, {
      'indent_inner_html': false,
      'indent_size': 2,
      'indent_char': ' ',
      'wrap_line_length': 0, // disable wrapping
      'brace_style': 'expand',
      'preserve_newlines': true,
      'max_preserve_newlines': 5,
      'indent_handlebars': false,
      'extra_liners': ['/html']
    })

    // Create a standalone HTML document?
    if (options.standalone) {
      let theme = options.theme || 'https://unpkg.com/stencila-web/build/document.min'
      html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="generator" content="stencila-node-${version}">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" type="text/css" href="${theme}.css">
  </head>
  <body>
    ${html}
    <script src="${theme}.js"></script>
  </body>
</html>
`
    }
    return html
  }

}

module.exports = DocumentHtmlConverter
