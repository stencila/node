/* eslint-disable no-console */

const test = require('tape')
var httpMocks = require('node-mocks-http');

const Host = require('../../src/host/Host')
const HostHttpServer = require('../../src/host/HostHttpServer')

test('HostHttpServer.stop+start', function (t) {
  let s = new HostHttpServer()

  s.start()
    .then(() => {
      t.ok(s.url().match(/http:\/\/127.0.0.1:(\d+)/))
    })
    .then(() => {
      return s.stop()
    })
    .then(() => {
      t.equal(s.url(), null)
      t.end()
    })
})

test('HostHttpServer.stop+start multiple', function (t) {
  let s1 = new HostHttpServer()
  let s2 = new HostHttpServer()

  s1.start()
    .then(() => {
      t.ok(s1.url().match(/http:\/\/127.0.0.1:(\d+)/))
    })
    .then(() => {
      return s2.start()
    })
    .then(() => {
      t.ok(s2.url().match(/http:\/\/127.0.0.1:(\d+)/))
      t.notEqual(s2.url(), s1.url())
    })
    .then(() => {
      return s1.stop()
    })
    .then(() => {
      return s2.stop()
    })
    .then(() => {
      t.equal(s1.url(), null)
      t.equal(s2.url(), null)
      t.end()
    })
})

test('HostHttpServer.handle', function (t) {
  t.plan(2)

  let s = new HostHttpServer()

  let mock1 = httpMocks.createMocks({method: 'GET', url: '/'})
  s.handle(mock1.req, mock1.res)
    .then(() => {
      t.equal(mock1.res.statusCode, 200)
    })
    .catch(error => {
      t.notOk(error)
    })

  let mock2 = httpMocks.createMocks({method: 'FOO', url: '/foo/bar', headers: {'Accept': 'application/json'}})
  s.handle(mock2.req, mock2.res)
    .then(() => {
      t.equal(mock2.res.statusCode, 400)
    })
    .catch(error => {
      t.notOk(error)
    })
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

  t.deepEqual(s.route('FOO', 'foo'), null)

  t.end()
})

test('HostHttpServer.home', function (t) {
  t.plan(3)
  
  let h = new Host()
  let s = new HostHttpServer(h)

  let mock1 = httpMocks.createMocks({headers:{'Accept': 'application/json'}})
  s.home(mock1.req, mock1.res)
    .then(() => {
      t.equal(mock1.res.statusCode, 200)
      let manifest = JSON.parse(mock1.res._getData())
      t.equal(manifest.stencila.package, 'node')
    })
    .catch(error => {
      t.notOk(error)
    })

  let mock2 = httpMocks.createMocks()
  s.home(mock2.req, mock2.res)
    .then(() => {
      t.equal(mock2.res.statusCode, 200)
    })
    .catch(error => {
      t.notOk(error)
    })
})

test('HostHttpServer.statico', function (t) {
  t.plan(7)
  let s = new HostHttpServer()

  let mock1 = httpMocks.createMocks()
  s.statico(mock1.req, mock1.res, 'logo-name-beta.svg')
    .then(() => {
      t.equal(mock1.res.statusCode, 200)
      t.equal(mock1.res._getHeaders()['Content-Type'], 'image/svg+xml')
      t.equal(mock1.res._getData().substring(0, 54), '<?xml version="1.0" encoding="UTF-8" standalone="no"?>')
    })
    .catch(error => {
      t.notOk(error)
    })

  let mock2 = httpMocks.createMocks()
  s.statico(mock2.req, mock2.res, '/foo')
    .then(() => {
      t.equal(mock2.res.statusCode, 404)
      t.equal(mock2.res._getData(), '{"error":"Not found","details":"/foo"}')
    })
    .catch(error => {
      t.notOk(error)
    })

  let mock3 = httpMocks.createMocks()
  s.statico(mock3.req, mock3.res, '../../../foo')
    .then(() => {
      t.equal(mock3.res.statusCode, 403)
      t.equal(mock3.res._getData(), '{"error":"Access denied","details":"../../../foo"}')
    })
    .catch(error => {
      t.notOk(error)
    })
})

test('HostHttpServer.post', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  let {req, res} = httpMocks.createMocks()
  req._setBody('')
  s.post(req, res, 'NodeContext') // Testing this
    .then(() => {
      t.equal(res.statusCode, 200)
      let id = res._getData()
      t.ok(h._instances[id])
      t.end()
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})

test('HostHttpServer.get', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  let {req, res} = httpMocks.createMocks()
  h.post('NodeContext')
    .then(id => {
      return s.get(req, res, id) // Testing this
    })
    .then(() => {
      t.equal(res.statusCode, 200)
      t.end()
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})

test('HostHttpServer.put', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  let {req, res} = httpMocks.createMocks({method: 'PUT', body: '{"code":"6*7"}'})

  h.post('NodeContext')
    .then(id => {
      t.ok(h._instances[id])
      return s.put(req, res, id, 'runCode') // Testing this
    })
    .then(() => {
      t.equal(res.statusCode, 200)
      let content = res._getData()
      t.equal(content,'{"errors":null,"output":{"type":"integer","format":"text","content":"42"}}')
      t.end()
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})

test('HostHttpServer.delete', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  let {req, res} = httpMocks.createMocks()
  h.post('NodeContext')
    .then(id => {
      t.ok(h._instances[id])
      s.delete(req, res, id) // Testing this
        .then(() => {
          t.equal(res.statusCode, 200)
          t.notOk(h._instances[id])
          t.end()
        })
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})
