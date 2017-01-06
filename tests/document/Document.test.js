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

  // Pandoc figure e.g. generated from the Markdown `![Caption](figure.png)`
  d.html = '<div class="figure"><img src="figure.png"><p class="caption">Caption</p></div>'
  t.equal(d.html, '<figure><img src="figure.png">\n  <figcaption>Caption</figcaption>\n</figure>')

  t.end()
})

test('Document can be loaded/dumped from/to Markdown', function (t) {
  let d = new Document()

  t.equal(d.md, '')

  let md = 'Hello from *Markdown*!\n'
  d.md = md

  t.equal(d.md, 'Hello from *Markdown*\\!') // Commonmark backslash escapes some characters see http://spec.commonmark.org/0.27/#backslash-escapes
  t.equal(d.html, '<p>Hello from <em>Markdown</em>!</p>')

  t.end()
})

test('Document can be loaded from Markdown with YAML metadata', function (t) {
  let d = new Document()

  let md = `---
title: Beep boop?
abstract: To beep or to boop, that is the question.
author: W. Shakebot
---
Beep boop!
`
  d.md = md
  t.equal(d.html, '<h1 id="title">Beep boop?</h1>\n<p class="author">W. Shakebot</p>\n<div id="summary">To beep or to boop, that is the question.</div>\n<p>Beep boop!</p>')

  t.end()
})

test.skip('Document can be loaded/dumped from/to RMarkdown', function (t) {
  let d = new Document()

  d.load('Hello from *RMarkdown*!\n``` {r}\nx <- 42\n```\n', 'rmd')

  t.equal(d.html, '<p>Hello from <em>RMarkdown</em>!\n<pre data-execute="r">x &lt;- 42</pre></p>')

  // t.equal(d.dump('rmd'), rmd)

  t.end()
})

test('Document select can be used to CSS select child elements', function (t) {
  let d = new Document()

  d.html = '<p id="para-1">Para1</p>'
  t.equal(d.select('#para-1').first().text(), 'Para1')

  t.end()
})
