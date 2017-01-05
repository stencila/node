const test = require('tape')

const JsSession = require('../../src/js-session/JsSession')

test('JsSession can be constructed', function (t) {
  let c = new JsSession()

  t.ok(c instanceof JsSession)
  t.end()
})
