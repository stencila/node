const { testAsync } = require('../helpers')
const httpMocks = require('node-mocks-http')

const Host = require('../../lib/host/Host')
const HostHttpServer = require('../../lib/host/HostHttpServer')

testAsync('HostHttpServer.stop+start', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)

  await server.start()
  assert.ok(server.url.match(/http:\/\/127.0.0.1:(\d+)/))

  await server.stop()
  assert.equal(server.url, null)

  assert.end()
})

testAsync('HostHttpServer.stop+start multiple', async assert => {
  let host = new Host()
  let server1 = new HostHttpServer(host)
  let server2 = new HostHttpServer(host)

  await server1.start()
  assert.ok(server1.url.match(/http:\/\/127.0.0.1:(\d+)/))

  await server2.start()
  assert.ok(server2.url.match(/http:\/\/127.0.0.1:(\d+)/))
  assert.notEqual(server2.url, server1.url)

  await server1.stop()
  await server2.stop()
  assert.equal(server1.url, null)
  assert.equal(server2.url, null)

  assert.end()
})

testAsync('HostHttpServer.handle authorization', async assert => {
  const host = new Host()
  await host.start() // To generate manifest and key files and start server
  const server = host._servers.http

  const peer = new Host()
  await peer.discoverPeers() // To get key for `host`

  const token1 = await peer.generateToken(host.id)
  const token2 = await peer.generateToken(host.id)

  let mock
  function authHeader (token) {
    return {'Authorization': 'Bearer ' + token}
  }

  mock = httpMocks.createMocks({method: 'POST', url: '/NodeContext'})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 403, 'Authorization fails because no token')

  mock = httpMocks.createMocks({method: 'POST', url: '/NodeContext', headers: {'Authorization': 'Bearer foo'}})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 403, 'Authorization fails because bad token')

  mock = httpMocks.createMocks({method: 'POST', url: '/NodeContext', headers: authHeader(token1)})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200, 'Authorization succeeds')

  mock = httpMocks.createMocks({method: 'POST', url: '/NodeContext', headers: authHeader(token1)})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 403, 'Authorization fails because attempting to reuse token')
  assert.equal(mock.res._getData().substring(0, 40), 'Forbidden: Attempt to reuse a token with')

  mock = httpMocks.createMocks({method: 'POST', url: '/NodeContext', headers: authHeader(token2)})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200, 'Authorization succeeds')

  await host.stop()
  assert.end()
})

testAsync('HostHttpServer.handle CORS', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)
  let mock

  mock = httpMocks.createMocks({method: 'GET', url: '/', headers: {'origin': 'http://127.0.0.1'}})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200)
  assert.equal(mock.res._headers['Access-Control-Allow-Origin'], 'http://127.0.0.1')

  mock = httpMocks.createMocks({method: 'GET', url: '/', headers: {'referer': 'http://localhost/some/page'}})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200)
  assert.equal(mock.res._headers['Access-Control-Allow-Origin'], 'http://localhost')

  mock = httpMocks.createMocks({method: 'GET', url: '/', headers: {'referer': 'http://builds.stenci.la'}})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200)
  assert.equal(mock.res._headers['Access-Control-Allow-Origin'], 'http://builds.stenci.la')

  mock = httpMocks.createMocks({method: 'GET', url: '/', headers: {'referer': 'http://evilhackers.com/some/page'}})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200)
  assert.equal(mock.res._headers['Access-Control-Allow-Origin'], undefined)

  mock = httpMocks.createMocks({method: 'GET', url: '/', headers: {'origin': 'http://spoof-stenci.la/'}})
  await server.handle(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200)
  assert.equal(mock.res._headers['Access-Control-Allow-Origin'], undefined)

  assert.end()
})

testAsync('HostHttpServer.route', assert => {
  let host = new Host()
  let server = new HostHttpServer(host)

  assert.deepEqual(server.route('GET', '/', true), [server.home])
  assert.deepEqual(server.route('GET', '/', false), [server.home])

  assert.deepEqual(server.route('GET', '/static/some/file.js', true), [server.statico, 'some/file.js'])
  assert.deepEqual(server.route('GET', '/static/some/file.js', false), [server.statico, 'some/file.js'])

  assert.deepEqual(server.route('POST', '/type', true), [server.create, 'type'])
  assert.deepEqual(server.route('POST', '/type', false), [server.error403, 'Authorization is required for POST /type'])

  assert.deepEqual(server.route('GET', '/id', true), [server.get, 'id'])

  assert.deepEqual(server.route('PUT', '/id!method', true), [server.call, 'id', 'method'])

  assert.deepEqual(server.route('DELETE', '/id', true), [server.destroy, 'id'])

  assert.deepEqual(server.route('FOO', 'foo', true), null)

  assert.end()
})

testAsync('HostHttpServer.options', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)
  let {req, res} = httpMocks.createMocks({method: 'OPTIONS', url: '/', headers: {'origin': 'http://localhost'}})

  await server.handle(req, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res._headers, {
    'Access-Control-Allow-Origin': 'http://localhost',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400'
  })

  assert.end()
})

testAsync('HostHttpServer.home', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)
  let mock = httpMocks.createMocks()

  await server.home(mock.req, mock.res)
  assert.equal(mock.res.statusCode, 200)

  assert.end()
})

testAsync('HostHttpServer.statico', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)

  let mock1 = httpMocks.createMocks()
  await server.statico(mock1.req, mock1.res, 'index.html')
  assert.equal(mock1.res.statusCode, 200)
  assert.equal(mock1.res._getHeaders()['Content-Type'], 'text/html; charset=UTF-8')
  assert.equal(mock1.res._getData().substring(0, 23), '<!doctype html>\n<html>\n')

  let mock2 = httpMocks.createMocks()
  await server.statico(mock2.req, mock2.res, '/foo')
  assert.equal(mock2.res.statusCode, 404)
  assert.equal(mock2.res._getData(), 'Not found: /foo')

  let mock3 = httpMocks.createMocks()
  await server.statico(mock3.req, mock3.res, '../../../foo')
  assert.equal(mock3.res.statusCode, 403)
  assert.equal(mock3.res._getData(), 'Forbidden: ../../../foo')

  assert.end()
})

testAsync('HostHttpServer.create', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)
  let {req, res} = httpMocks.createMocks()
  req._setBody('')

  await server.create(req, res, 'NodeContext')
  assert.equal(res.statusCode, 200)
  let id = JSON.parse(res._getData())
  assert.ok(host._instances[id])

  assert.end()
})

testAsync('HostHttpServer.get', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)
  let {req, res} = httpMocks.createMocks()
  let {id} = await host.create('NodeContext')

  await server.get(req, res, id)
  assert.equal(res.statusCode, 200)

  assert.end()
})

testAsync('HostHttpServer.call', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)
  let {req, res} = httpMocks.createMocks()
  let {id} = await host.create('NodeContext')

  await server.call(req, res, id, 'pack', 42)
  assert.equal(res.statusCode, 200)
  let content = res._getData()
  assert.equal(content, '{"type":"number","data":42}')

  assert.end()
})

testAsync('HostHttpServer.destroy', async assert => {
  let host = new Host()
  let server = new HostHttpServer(host)
  let {req, res} = httpMocks.createMocks()
  let {id} = await host.create('NodeContext')

  await server.destroy(req, res, id)
  assert.equal(res.statusCode, 200)
  assert.notOk(host._instances[id])

  assert.end()
})
