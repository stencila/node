const test = require('tape')

const Session = require('../../src/session/Session')

test('Session can be constructed', function (t) {
  let c = new Session()

  t.ok(c instanceof Session)
  t.end()
})
