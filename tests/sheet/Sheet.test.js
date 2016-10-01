const test = require('tape')

const Sheet = require('../../src/sheet/Sheet')

test('Sheet can be constructed', function (t) {
  let c = new Sheet()

  t.ok(c instanceof Sheet)
  t.end()
})
