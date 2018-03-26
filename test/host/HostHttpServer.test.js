const test = require('tape')
const httpMocks = require('node-mocks-http')

const Host = require('../../lib/host/Host')
const HostHttpServer = require('../../lib/host/HostHttpServer')

test('HostHttpServer.stop+start', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  s.start()
    .then(() => {
      t.ok(s.url.match(/http:\/\/127.0.0.1:(\d+)/))
    })
    .then(() => {
      return s.stop()
    })
    .then(() => {
      t.equal(s.url, null)
      t.end()
    })
})

test('HostHttpServer.stop+start multiple', function (t) {
  let h = new Host()
  let s1 = new HostHttpServer(h)
  let s2 = new HostHttpServer(h)

  s1.start()
    .then(() => {
      t.ok(s1.url.match(/http:\/\/127.0.0.1:(\d+)/))
    })
    .then(() => {
      return s2.start()
    })
    .then(() => {
      t.ok(s2.url.match(/http:\/\/127.0.0.1:(\d+)/))
      t.notEqual(s2.url, s1.url)
    })
    .then(() => {
      return s1.stop()
    })
    .then(() => {
      return s2.stop()
    })
    .then(() => {
      t.equal(s1.url, null)
      t.equal(s2.url, null)
      t.end()
    })
})

test('HostHttpServer.handle authorization', async assert => {
  const host = new Host()
  await host.start() // To generate key file and start server
  const server = host._servers.http

  const peer = new Host()
  await peer.discoverPeers() // To get key for `host`

  const token1 = await peer.generateToken(host.id)
  const token2 = await peer.generateToken(host.id)

  let mock
  function authHeader (token) {
    return {'Authorization': 'Bearer ' + token}
  }

  mock = httpMocks.createMocks({method: 'GET', url: '/manifest'})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 403, 'Authorization fails because no token')

  mock = httpMocks.createMocks({method: 'GET', url: '/manifest', headers: {'Authorization': 'Bearer foo'}})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 403, 'Authorization fails because bad token')

  mock = httpMocks.createMocks({method: 'GET', url: '/manifest', headers: authHeader(token1)})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200, 'Authorization succeeds')

  mock = httpMocks.createMocks({method: 'GET', url: '/manifest', headers: authHeader(token1)})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 403, 'Authorization fails because attempting to reuse token')

  mock = httpMocks.createMocks({method: 'GET', url: '/manifest', headers: authHeader(token2)})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200, 'Authorization succeeds')

  await host.stop()
  assert.end()
})

test('HostHttpServer.handle CORS passes', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  Promise.resolve().then(() => {
    let mock = httpMocks.createMocks({
      method: 'GET',
      url: '/',
      headers: {'origin': 'http://127.0.0.1'}
    })
    return s.handle(mock.req, mock.res)
      .then(() => {
        t.equal(mock.res.statusCode, 200)
        t.equal(mock.res._headers['Access-Control-Allow-Origin'], 'http://127.0.0.1')
      })
  }).then(() => {
    let mock = httpMocks.createMocks({
      method: 'GET',
      url: '/',
      headers: {'referer': 'http://localhost/some/page'}
    })
    return s.handle(mock.req, mock.res)
      .then(() => {
        t.equal(mock.res.statusCode, 200)
        t.equal(mock.res._headers['Access-Control-Allow-Origin'], 'http://localhost')
      })
  }).then(() => {
    let mock = httpMocks.createMocks({
      method: 'GET',
      url: '/',
      headers: {'referer': 'http://builds.stenci.la'}
    })
    return s.handle(mock.req, mock.res)
      .then(() => {
        t.equal(mock.res.statusCode, 200)
        t.equal(mock.res._headers['Access-Control-Allow-Origin'], 'http://builds.stenci.la')
      })
  }).then(() => {
    t.end()
  })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})

test('HostHttpServer.handle CORS fails', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  Promise.resolve().then(() => {
    let mock = httpMocks.createMocks({
      method: 'GET',
      url: '/',
      headers: {'referer': 'http://evilhackers.com/some/page'}
    })
    return s.handle(mock.req, mock.res)
      .then(() => {
        t.equal(mock.res.statusCode, 200)
        t.equal(mock.res._headers['Access-Control-Allow-Origin'], undefined)
      })
  }).then(() => {
    let mock = httpMocks.createMocks({
      method: 'GET',
      url: '/',
      headers: {'origin': 'http://spoof-stenci.la/'}
    })
    return s.handle(mock.req, mock.res)
      .then(() => {
        t.equal(mock.res.statusCode, 200)
        t.equal(mock.res._headers['Access-Control-Allow-Origin'], undefined)
      })
  }).then(() => {
    t.end()
  })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})

test('HostHttpServer.route', assert => {
  let host = new Host()
  let server = new HostHttpServer(host)

  assert.deepEqual(server.route('GET', '/', true), [server.home])
  assert.deepEqual(server.route('GET', '/', false), [server.home])

  assert.deepEqual(server.route('GET', '/static/some/file.js', true), [server.statico, 'some/file.js'])
  assert.deepEqual(server.route('GET', '/static/some/file.js', false), [server.statico, 'some/file.js'])

  assert.deepEqual(server.route('POST', '/type', true), [server.create, 'type'])
  assert.deepEqual(server.route('POST', '/type', false), [server.error403, 'Authorization is required for POST /type'])

  assert.deepEqual(server.route('GET', '/name', true), [server.get, 'name'])

  assert.deepEqual(server.route('PUT', '/name!method', true), [server.call, 'name', 'method'])

  assert.deepEqual(server.route('DELETE', '/name', true), [server.delete, 'name'])

  assert.deepEqual(server.route('FOO', 'foo', true), null)

  assert.end()
})

test('HostHttpServer.home', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  let mock = httpMocks.createMocks()
  s.home(mock.req, mock.res)
    .then(() => {
      t.equal(mock.res.statusCode, 200)
      t.end()
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})

test('HostHttpServer.statico', function (t) {
  t.plan(7)
  let h = new Host()
  let s = new HostHttpServer(h)

  let mock1 = httpMocks.createMocks()
  s.statico(mock1.req, mock1.res, 'index.html')
    .then(() => {
      t.equal(mock1.res.statusCode, 200)
      t.equal(mock1.res._getHeaders()['Content-Type'], 'text/html; charset=UTF-8')
      t.equal(mock1.res._getData().substring(0, 23), '<!doctype html>\n<html>\n')
    })
    .catch(error => {
      t.notOk(error)
    })

  let mock2 = httpMocks.createMocks()
  s.statico(mock2.req, mock2.res, '/foo')
    .then(() => {
      t.equal(mock2.res.statusCode, 404)
      t.equal(mock2.res._getData(), 'Not found: /foo')
    })
    .catch(error => {
      t.notOk(error)
    })

  let mock3 = httpMocks.createMocks()
  s.statico(mock3.req, mock3.res, '../../../foo')
    .then(() => {
      t.equal(mock3.res.statusCode, 403)
      t.equal(mock3.res._getData(), 'Forbidden: ../../../foo')
    })
    .catch(error => {
      t.notOk(error)
    })
})

test('HostHttpServer.create', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  let {req, res} = httpMocks.createMocks()
  req._setBody('')
  s.create(req, res, 'NodeContext') // Testing this
    .then(() => {
      t.equal(res.statusCode, 200)
      let name = JSON.parse(res._getData())
      t.ok(h._instances[name])
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
  h.create('NodeContext')
    .then(result => {
      return s.get(req, res, result.name) // Testing this
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

test.skip('HostHttpServer.call', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)

  let {req, res} = httpMocks.createMocks()

  h.create('NodeContext')
    .then(result => {
      let {name} = result
      t.ok(h._instances[name])
      return s.call(req, res, name, 'runCode', {code: '6*7'}) // Testing this
    })
    .then(() => {
      t.equal(res.statusCode, 200)
      let content = res._getData()
      t.equal(content, '{"errors":null,"output":{"type":"integer","format":"text","content":"42"}}')
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
  h.create('NodeContext')
    .then(result => {
      let {name} = result
      t.ok(h._instances[name])
      s.delete(req, res, name) // Testing this
        .then(() => {
          t.equal(res.statusCode, 200)
          t.notOk(h._instances[name])
          t.end()
        })
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})
