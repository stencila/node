const test = require('tape')

const Host = require('../../src/host/Host')

test.skip('Host can serve', function (t) {
  let h = new Host()
  h.serve()
  t.ok(h.url)
  h.serve(false)
  t.notOk(h.url)

  t.end()
})

test('Host can find peers', function (t) {
  let h1 = new Host()
  h1.serve()
  let h2 = new Host()
  h2.serve()

  setTimeout(function () {
    t.notEqual(h1.url, h2.url)

    h1.discover()
    h2.discover()

    setTimeout(function () {
      t.ok(h1.peers.length > 0)
      t.ok(h2.peers.length > 0)

      t.deepEqual(h1.peers, [])
      t.deepEqual(h2.peers, [])

      // h1.serve(false)
      // h2.serve(false)
      t.end()
    }, 2000)
  }, 2000)
})
