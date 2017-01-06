const test = require('tape')

const HostHttpServer = require('../../src/host/HostHttpServer')

test('HostHttpServer can serve', function (t) {
  let s = new HostHttpServer()

  t.equal(s.status, 'off')
  s.serve()
  t.equal(s.status, 'on')
  s.serve(false)
  t.equal(s.status, 'off')

  t.end()
})

test('HostHttpServer routes to endpoints correctly', function (t) {
  let s = new HostHttpServer()

  t.deepEqual(s.route('GET', '/web/some/file.js'), [s.web, 'some/file.js'])
  t.deepEqual(s.route('GET', '/favicon.ico'), [s.web, 'images/favicon.ico'])

  t.deepEqual(s.route('GET', '/some-image.png?raw'), [s.raw, 'some-image.png'])

  t.deepEqual(s.route('GET', '/'), [s.show, null])
  t.deepEqual(s.route('GET', '/scheme://some/address'), [s.show, 'scheme://some/address'])

  t.deepEqual(s.route('GET', '/!property'), [s.get, null, 'property'])
  t.deepEqual(s.route('GET', '/scheme://some/address!property'), [s.get, 'scheme://some/address', 'property'])

  t.deepEqual(s.route('PUT', '/!property'), [s.set, null, 'property'])
  t.deepEqual(s.route('PUT', '/scheme://some/address!property'), [s.set, 'scheme://some/address', 'property'])

  t.deepEqual(s.route('POST', '/!method'), [s.call, null, 'method'])
  t.deepEqual(s.route('POST', '/scheme://some/address!method'), [s.call, 'scheme://some/address', 'method'])

  t.end()
})

