const test = require('tape')

const Controller = require('../../src/controller/Controller')
const RemoteComponent = require('../../src/component/RemoteComponent')

var controller = Controller.controller
controller.serve()

test('RemoteComponent can be constructed', function (t) {
  let c = new RemoteComponent()

  t.ok(c instanceof RemoteComponent)
  t.end()
})

test('RemoteComponent can get a property', function (t) {
  let c = new RemoteComponent(controller.url, '+document')
  c.get('type')
    .then(function (value) {
      t.equal(value, 'document')
      t.end()
    })
})

test('RemoteComponent can set a property', function (t) {
  let c = new RemoteComponent(controller.url, '+document')
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
  let c = new RemoteComponent(controller.url, '+jssession')
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
