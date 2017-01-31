const test = require('tape')

const JsSession = require('../../src/js-session/JsSession')

test('JsSession', function (t) {
  let s = new JsSession()

  t.ok(s instanceof JsSession)

  t.equal(JsSession.type, 'js-session')
  t.equal(s.type, 'js-session')

  t.equal(JsSession.kind, 'session')
  t.equal(s.kind, 'session')

  t.end()
})

test('JsSession.execute', function (t) {
  let s = new JsSession()

  t.equal(typeof s.execute, 'function')

  t.deepEqual(s.execute('6*7'), {errors: {}, output: { format: 'text', type: 'int', value: '42' }})

  t.end()
})
