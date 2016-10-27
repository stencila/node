const test = require('tape')

const Host = require('../../src/host/Host')

test('Host can serve', function (t) {
  let h = new Host()
  h.serve()
  t.ok(h.url)
  h.serve(false)
  t.notOk(h.url)

  t.end()
})

test('Host can discover peers', function (t) {
  let h1 = new Host()
  h1.serve().then(() => {
    let h2 = new Host()
    h2.serve().then(() => {
      t.notEqual(h1.url, h2.url)
      // When h1 discovers h2, they exchange manifests so this works without h2.discover()
      h1.discover()
      // Until discover is promisfies, using a timeout!
      setTimeout(() => {
        // These tests allow for the fact that more than these two hosts may be running on this machine
        console.log(h1.peers)
        console.log(h2.peers)
        t.ok(h1.peers.length > 0)
        t.ok(h2.peers.length > 0)

        t.ok(h1.peers.map(peer => peer.url).indexOf(h2.url) > -1)
        t.ok(h2.peers.map(peer => peer.url).indexOf(h1.url) > -1)

        h1.serve(false)
        h2.serve(false)
        t.end()
      }, 1000)
    }).catch(error => {
      t.notOk(error)
      t.end()
    })
  }).catch(error => {
    t.notOk(error)
    t.end()
  })
})
