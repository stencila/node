const test = require('tape')

const Document = require('../../src/document/Document')

test('Document can be constructed', function (t) {
  let c = new Document()

  t.ok(c instanceof Document)
  t.end()
})
