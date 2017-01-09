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

test('Document can be loaded/dumped from/to Markdown', function (t) {
  let d = new Document()

  t.equal(d.md, '')
  t.equal(d.html, '')

  let md = 'Hello from *Markdown*\\!' // Pandoc backslash escapes some characters see http://spec.commonmark.org/0.27/#backslash-escapes
  let html = '<p>Hello from <em>Markdown</em>!</p>'

  d.md = md
  t.equal(d.md, md)
  t.equal(d.html, html)

  d.html = html
  t.equal(d.html, html)
  t.equal(d.md, md)

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

  t.end()
})

test.skip('Document Pandoc Markdown "implicit_figures" to HTML5 figure', function (t) {
  let d = new Document()

  d.md = '![Caption](figure.png)'
  t.equal(d.html, '<figure><img src="figure.png?raw">\n  <figcaption>Caption</figcaption>\n</figure>')

  t.end()
})

test('Document Pandoc Markdown "fenced_code_blocks" with parentheses to execute directives', function (t) {
  let d = new Document()

  d.md = '```r\nx*2\n```'
  t.equal(d.html, '<pre class="r"><code>x*2</code></pre>')

  d.md = '```r()\nx*2\n```'
  t.equal(d.html, '<pre data-execute="r">x*2</pre>')

  d.md = '```r(a,b)\nx*2\n```'
  t.equal(d.html, '<pre data-execute="r" data-input="a,b">x*2</pre>')

  d.md = '```a=r()\nx*2\n```'
  t.equal(d.html, '<pre data-execute="r" data-output="a">x*2</pre>')

  d.md = '```c=r(a,b)\nx*2\n```'
  t.equal(d.html, '<pre data-execute="r" data-output="c" data-input="a,b">x*2</pre>')

  t.end()
})

test('Document Pandoc Markdown "bracketed_spans" of class input to inputs', function (t) {
  let d = new Document()

  d.md = 'An inline [bracketed_span]{.class attr="foo"}.'
  t.equal(d.html, '<p>An inline <span class="class" attr="foo">bracketed_span</span>.</p>')

  d.md = 'An inline input [45]{.input name="a"}.'
  t.equal(d.html, '<p>An inline input <input name="a" value="45">.</p>')

  t.end()
})

test('Document select can be used to CSS select child elements', function (t) {
  let d = new Document()

  d.html = '<p id="para-1">Para1</p>'
  t.equal(d.select('#para-1').first().text(), 'Para1')

  t.end()
})
