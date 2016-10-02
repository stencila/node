const test = require('tape')

const HttpServer = require('../../src/servers/HttpServer')

test('HttpServer can serve', function (t) {
  let s = new HttpServer()
  t.equal(s.status, 'off')
  s.serve()
  t.equal(s.status, 'on')
  s.serve(false)
  t.equal(s.status, 'off')
  t.end()
})

test('HttpServer routes to endpoints correctly', function (t) {
  let s = new HttpServer()

  t.deepEqual(s.route('GET', '/web/some/file.js'), [s.web, 'some/file.js'])
  t.deepEqual(s.route('GET', '/favicon.ico'), [s.web, 'images/favicon.ico'])

  t.end()

  /*
  t.equal(s.route('/'), ['get', null])
  t.equal(s.route('/!manifest'), ['call', null, 'manifest'])

  t.equal(s.route('/new/sheet'), ['new', 'sheet'])

  t.equal(s.route('/mem://some/address'), ['get', 'mem://some/address'])
  t.equal(s.route('/file://some/address'), ['get', 'file://some/address'])

  t.equal(s.route('/mem://some/address!method'), ['call', 'mem://some/address', 'method'])
  */
})


// Exit the process when all tests have finished running
// (otherwise server keeps on servin`)
test.onFinish(function () {
  process.exit()
})
