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

test('HostHttpServer.handle unauthorized', function (t) {
  let h = new Host()
  let s = new HostHttpServer(h)
  let mock = httpMocks.createMocks({method: 'GET', url: '/manifest'})
  s.handle(mock.req, mock.res)
    .then(() => {
      t.equal(mock.res.statusCode, 403)
      t.end()
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})

test('HostHttpServer.handle authorized', async function (t) {
  let host = new Host()
  await host.start()
  const s = host._servers.http
  const token = await host.token()

  // Authorization using a ticket
  let mock = httpMocks.createMocks({
    method: 'GET',
    url: '/manifest',
    headers: {
      'Authorization': 'Bearer ' + token
    }
  })
  s.handle(mock.req, mock.res).then(() => {
    t.equal(mock.res.statusCode, 200)
  }).then(() => {
    let mock = httpMocks.createMocks({
      method: 'GET',
      url: '/manifest',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
    return s.handle(mock.req, mock.res)
      .then(() => {
        t.equal(mock.res.statusCode, 200)
      })
  }).then(() => {
    // Authorization using the token but bad request
    let mock = httpMocks.createMocks({
      method: 'FOO',
      url: '/foo',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    })
    return s.handle(mock.req, mock.res)
      .then(() => {
        t.equal(mock.res.statusCode, 400)
      })
  }).then(() => {
    t.end()
  }).catch(error => {
    t.notOk(error)
    t.end()
  })
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

test('HostHttpServer.route', function (t) {
  // Set key to false for this test
  let h = new Host(false)
  let s = new HostHttpServer(h)

  t.deepEqual(s.route('GET', '/'), [s.home])

  t.deepEqual(s.route('GET', '/static/some/file.js'), [s.statico, 'some/file.js'])

  t.deepEqual(s.route('POST', '/type'), [s.create, 'type'])

  t.deepEqual(s.route('GET', '/name'), [s.get, 'name'])

  t.deepEqual(s.route('PUT', '/name!method'), [s.call, 'name', 'method'])

  t.deepEqual(s.route('DELETE', '/name'), [s.delete, 'name'])

  t.deepEqual(s.route('FOO', 'foo'), null)

  t.end()
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
