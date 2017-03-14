const test = require('tape')

const Host = require('../../src/host/Host')

test('Host', t => {
  let h = new Host()

  t.ok(h instanceof Host)

  t.end()
})

test('Host.start+stop', t => {
  let h = new Host()

  h.start()
    .then(() => {
      t.ok(h._servers.http)
      h.stop()
        .then(() => {
          t.notOk(h._servers.http)
          t.end()
        })
    })
})
