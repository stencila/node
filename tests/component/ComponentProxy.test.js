const test = require('tape')

const host = require('../../src/host/host')
const ComponentProxy = require('../../src/component/ComponentProxy')

host.serve().then(() => {
  test('ComponentProxy can be constructed', function (t) {
    let c = new ComponentProxy()

    t.ok(c instanceof ComponentProxy)
    t.end()
  })

  test('ComponentProxy can get a property', function (t) {
    let c = new ComponentProxy('document', null, null, host.url + '/+document')
    c.get('type')
      .then(function (value) {
        t.equal(value, 'document')
        t.end()
      })
      .catch(error => {
        t.notOk(error)
        t.end()
      })
  })

  test('ComponentProxy can set a property', function (t) {
    let c = new ComponentProxy('document', null, null, host.url + '/+document')
    c.set('html', '<p>Hello from Node.js</p>')
      .then(function () {
        t.end()
      })
      .catch(function (error) {
        t.notOk(error)
        t.end()
      })
  })

  test.skip('ComponentProxy can call a method', function (t) {
    let c = new ComponentProxy('document', null, null, host.url + '/+jssession')
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
})
