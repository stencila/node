const cheerio = require('cheerio')
const $ = cheerio
const beautify = require('js-beautify')

const version = require('../../package').version
const ComponentConverter = require('../component/ComponentConverter')

class DocumentHtmlConverter extends ComponentConverter {

  load (document, content, format, options) {
    let dom = cheerio.load(content)
    // Pandoc HTML -> Stencila HTML5
    dom('div.figure').toArray().forEach(el => {
      el.name = 'figure'
      el = $(el)
      el.removeClass('figure')
      if (el.attr('class') === '') el.removeAttr('class')
      el.find('p.caption').toArray().forEach(el => {
        el.name = 'figcaption'
        el = $(el)
        el.removeClass('caption')
        if (el.attr('class') === '') el.removeAttr('class')
      })
    })
    document.content = dom
  }

  dump (document, format, options) {
    options = options || {}

    let html = document.content.html()
    // See beautification options at https://github.com/beautify-web/js-beautify/blob/master/js/lib/beautify-html.js
    html = beautify.html(html)
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
