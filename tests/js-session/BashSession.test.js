const test = require('tape')

const BashSession = require('../../src/bash-session/BashSession')

test('BashSession', function (t) {
  let s = new BashSession()

  t.ok(s instanceof BashSession)

  t.equal(BashSession.type, 'bash-session')
  t.equal(s.type, 'bash-session')

  t.equal(BashSession.kind, 'session')
  t.equal(s.kind, 'session')

  t.end()
})

test('BashSession.execute', function (t) {
  let s = new BashSession()

  t.equal(typeof s.execute, 'function')

  s.execute('echo "foo bar"').then(result => {
    t.deepEqual(result, {errors: {}, output: { format: 'text', type: 'str', value: 'foo bar' }})
  })

  t.end()
})
