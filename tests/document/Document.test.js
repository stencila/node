const test = require('tape')

const Document = require('../../src/document/Document')

test('Document can be constructed', function (t) {
  let d = new Document()

  t.ok(d instanceof Document)
  t.end()
})

test('Document content is exposed as a full property', function (t) {
  let d = new Document()

  t.ok(d.content)
  t.end()
})

test('Document can be loaded/dumped from/to HTML', function (t) {
  let d = new Document()

  t.equal(d.html, '')

  let html = '<p>Hello</p>'
  d.html = html
  t.equal(d.html, html)

  t.end()
})

test('Document select can be used to CSS select child elements', function (t) {
  let d = new Document()

  d.html = '<p id="para-1">Para1</p>'
  t.equal(d.select('#para-1').text(), 'Para1')

  t.end()
})

test('Document render', function (t) {
  let d = new Document()

  d.html = '<pre data-print="6*7"></pre>'
  d.render()
  t.equal(d.select('[data-print]').text(), '42')

  t.end()
})

