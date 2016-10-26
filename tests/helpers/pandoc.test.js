const fs = require('fs')
const path = require('path')
const tmp = require('tmp')
const test = require('tape')

const pandoc = require('../../src/helpers/pandoc')

test('Pandoc is enabled', function (t) {
  t.ok(pandoc.enabled())
  t.end()
})

test('Pandoc can convert Markdown to HTML', function (t) {
  t.equal(pandoc.convert('Hello *world*', 'markdown', 'html'), '<p>Hello <em>world</em></p>\n')
  t.end()
})

test('Pandoc can read Markdown to HTML', function (t) {
  t.equal(pandoc.read(path.join(__dirname, '../document/document.md'), 'markdown', 'html'), '<p>Hello from <em>Markdown</em>!</p>\n')
  t.end()
})

test('Pandoc can write HTML to Markdown', function (t) {
  let file = tmp.fileSync().name
  pandoc.write('<p>Hello from <em>Markdown</em>!</p>\n', 'html', 'markdown', file)
  t.equal(fs.readFileSync(file, 'utf8'), 'Hello from *Markdown*!\n')
  t.end()
})

