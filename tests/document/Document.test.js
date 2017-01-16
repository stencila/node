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

  d.md = '```r(){width=100}\nplot(x,y)\n```'
  t.equal(d.html, '<pre data-execute="r" data-width="100">plot(x,y)</pre>')

  d.md = '```c=r(a,b){foo=bar}\n\n```'
  t.equal(d.html, '<pre data-execute="r" data-output="c" data-input="a,b" data-foo="bar"></pre>')

  t.end()
})

test('Document Pandoc Markdown "bracketed_spans" of with a name attribute to inputs', function (t) {
  let d = new Document()

  d.md = 'An inline [bracketed_span]{.class attr="foo"}.'
  t.equal(d.html, '<p>An inline <span class="class" attr="foo">bracketed_span</span>.</p>')

  d.md = 'An inline [bracketed_span]{.class name=foo}.' // Use a class to ensure a span with name attr does not become an <input>
  t.equal(d.html, '<p>An inline <span class="class" name="foo">bracketed_span</span>.</p>')

  d.md = 'An inline input [45]{name=a}.'
  t.equal(d.html, '<p>An inline input <input name="a" value="45">.</p>')

  d.md = 'An inline input [45]{.input name=a}.' // Can optionally use class=input
  t.equal(d.html, '<p>An inline input <input class="input" name="a" value="45">.</p>')

  t.end()
})

test('Document Pandoc Markdown "bracketed_spans" with a name attribute to <input>s', function (t) {
  let d = new Document()

  d.md = 'An inline [bracketed_span]{.class name=foo}.' // Use a class to ensure a span with name attr does not become an <input>
  t.equal(d.html, '<p>An inline <span class="class" name="foo">bracketed_span</span>.</p>')

  d.md = 'An inline input [45]{name=a}.'
  t.equal(d.html, '<p>An inline input <input name="a" value="45">.</p>')

  d.md = 'An inline input [45]{.input name=a}.' // Can optionally use class=input
  t.equal(d.html, '<p>An inline input <input class="input" name="a" value="45">.</p>')

  t.end()
})

test('Document Pandoc Markdown "bracketed_spans" for a select input', function (t) {
  let d = new Document()

  d.md = '[nashi]{name=a type=select apple=Apple nashi="Nashi Pear" pear=Pear}'
  t.equal(d.html, '<p><select name="a"><option value="apple">Apple</option><option value="nashi" selected="true">Nashi Pear</option><option value="pear">Pear</option></select></p>')

  t.end()
})

test('Document Pandoc Markdown "bracketed_spans" with a value attribute to <output>s', function (t) {
  let d = new Document()

  d.md = '[]{value=a}'
  t.equal(d.html, '<p><output for="a"></output></p>')

  d.md = '[]{value=a format="%2d"}'
  t.equal(d.html, '<p><output for="a" data-format="%2d"></output></p>')

  d.md = '[]{.class value=a}'
  t.equal(d.html, '<p><span class="class" value="a"></span></p>')

  d.md = '[]{.output value=a}'
  t.equal(d.html, '<p><output class="output" for="a"></output></p>')

  t.end()
})

test('Document Pandoc Markdown with inclusion', function (t) {
  let d = new Document()

  d.md = `< address/of/some/other/document.md@fc453b6`
  t.equal(d.html, '<div data-include="address/of/some/other/document.md@fc453b6"></div>')

  d.md = `< https://address/of/a/document (var1, var2)"`
  t.equal(d.html, '<div data-include="https://address/of/a/document" data-input="var1, var2"></div>')

  d.md = `< address selector`
  t.equal(d.html, '<div data-include="address" data-select="selector"></div>')

  d.md = `< address selector can have spaces (var1, var2)`
  t.equal(d.html, '<div data-include="address" data-select="selector can have spaces" data-input="var1, var2"></div>')

  d.md = `
< address selector1 (var1, var2)

& change selector2
:    This is the new Markdown content for the selected element
`
  t.equal(d.html,
`<div data-include="address" data-select="selector1" data-input="var1, var2">
  <div data-change="selector2">This is the new Markdown content for the selected element\n  </div>
</div>`)

  d.md = `
< address selector1 (var1, var2)

& change selector2
:    This is the new *Markdown* content with block elements
     
     - One
     - Two
`
  t.equal(d.html,
`<div data-include="address" data-select="selector1" data-input="var1, var2">
  <div data-change="selector2">
    <p>This is the new <em>Markdown</em> content with block elements</p>
    <ul>
      <li>One</li>
      <li>Two</li>
    </ul>
  </div>
</div>`)

  t.end()
})

test('Document select can be used to CSS select child elements', function (t) {
  let d = new Document()

  d.html = '<p id="para-1">Para1</p>'
  t.equal(d.select('#para-1').first().text(), 'Para1')

  t.end()
})
