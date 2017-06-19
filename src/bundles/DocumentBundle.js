const stencila = require('stencila')

const Bundle = require('./Bundle.js')

class DocumentBundle extends Bundle {}

DocumentBundle.storers = Bundle.storers

DocumentBundle.converters = [
  stencila.DocumentHTMLConverter,
  stencila.DocumentMarkdownConverter
]

DocumentBundle.page = 'document.html'

module.exports = DocumentBundle
