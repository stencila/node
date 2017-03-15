const test = require('tape')

const HostHttpServer = require('../../src/host/HostHttpServer')

test('HostHttpServer.stop+start', function (t) {
  let s = new HostHttpServer()

  s.start()
    .then(() => {
      t.equal(s.status, 'on')
      t.ok(s.url)
    })
    .then(() => {
      return s.stop()
    })
    .then(() => {
      t.equal(s.status, 'off')
    })

  t.end()
})

test('HostHttpServer.route', function (t) {
  let s = new HostHttpServer()

  t.deepEqual(s.route('GET', '/'), [s.home])

  t.deepEqual(s.route('GET', '/static/some/file.js'), [s.statico, 'some/file.js'])
  t.deepEqual(s.route('GET', '/favicon.ico'), [s.statico, 'favicon.ico'])

  t.deepEqual(s.route('POST', '/type'), [s.post, 'type'])

  t.deepEqual(s.route('GET', '/id'), [s.get, 'id'])

  t.deepEqual(s.route('PUT', '/id!method'), [s.put, 'id', 'method'])

  t.deepEqual(s.route('DELETE', '/id'), [s.delete, 'id'])

  t.end()
})

