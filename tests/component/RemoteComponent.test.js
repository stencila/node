const test = require('tape')

const Host = require('../../src/host/Host')
const RemoteComponent = require('../../src/component/RemoteComponent')

var host = Host.host
host.serve()

test('RemoteComponent can be constructed', function (t) {
  let c = new RemoteComponent()

  t.ok(c instanceof RemoteComponent)
  t.end()
})

test('RemoteComponent can get a property', function (t) {
  let c = new RemoteComponent(host.url, '+document')
  c.get('type')
    .then(function (value) {
      t.equal(value, 'document')
      t.end()
    })
})

test('RemoteComponent can set a property', function (t) {
  let c = new RemoteComponent(host.url, '+document')
  c.set('html', '<p>Hello from Node.js</p>')
    .then(function () {
      t.end()
    })
    .catch(function (error) {
      t.notOk(error)
      t.end()
    })
})

test.skip('RemoteComponent can call a method', function (t) {
  let c = new RemoteComponent(host.url, '+jssession')
  c.call('print', '6*7')
    .then(function (value) {
      t.equal(value, '42')
      t.end()
    })
    .catch(function (error) {
      t.notOk(error)
      t.end()
    })
})
