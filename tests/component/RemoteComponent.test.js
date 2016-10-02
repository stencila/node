const test = require('tape')

const RemoteComponent = require('../../src/component/RemoteComponent')

test('RemoteComponent can be constructed', function (t) {
  let c = new RemoteComponent()

  t.ok(c instanceof RemoteComponent)
  t.end()
})

test('RemoteComponent can get a property', function (t) {
  let c = new RemoteComponent('http://127.0.0.1:2000', '+document')
  c.get('type')
    .then(function (value) {
      t.equal(value, 'document')
      t.end()
    })
})

test('RemoteComponent can set a property', function (t) {
  let c = new RemoteComponent('http://127.0.0.1:2000', '+document')
  c.set('html', '<p>Hello from Node.js</p>')
    .then(function () {
      t.end()
    })
    .catch(function (error) {
      t.notOk(error)
      t.end()
    })
})

test('RemoteComponent can call a method', function (t) {
  let c = new RemoteComponent('http://127.0.0.1:2000', '+session')
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
