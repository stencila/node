const test = require('tape')

const host = require('../../src/host/host')
const ComponentDelegate = require('../../src/component/ComponentDelegate')

host.serve().then(() => {
  test('ComponentDelegate can be constructed', function (t) {
    let c = new ComponentDelegate()

    t.ok(c instanceof ComponentDelegate)
    t.end()
  })

  test('ComponentDelegate can get a property', function (t) {
    let c = new ComponentDelegate(host.url + '/+document')
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

  test('ComponentDelegate can set a property', function (t) {
    let d = host.create('document')
    let c = new ComponentDelegate(d.url)
    c.set('html', '<p>Hello from Node.js</p>')
      .then(function () {
        t.equal(d.html, '<p>Hello from Node.js</p>')
        t.end()
      })
      .catch(function (error) {
        t.notOk(error)
        t.end()
      })
  })

  test('ComponentDelegate can call a method', function (t) {
    let c = new ComponentDelegate(host.url + '/+js-session')
    c.call('execute', '6*7')
      .then(function (value) {
        t.deepEqual(value, { errors: {}, output: { format: 'text', type: 'int', value: '42' } })
        t.end()
      })
      .catch(function (error) {
        t.notOk(error)
        t.end()
      })
  })
})
