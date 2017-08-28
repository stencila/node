const test = require('tape')

const Host = require('../../src/host/Host')
const NodeContext = require('../../src/node-context/NodeContext')
const version = require('../../package').version

test('Host', t => {
  let h = new Host()

  t.ok(h instanceof Host)

  t.end()
})

test('Host.manifest', t => {
  let h = new Host()

  let manifest = h.manifest()
  t.equal(manifest.stencila.package, 'node')
  t.equal(manifest.stencila.version, version)
  t.deepEqual(manifest.schemes.new.NodeContext, NodeContext.spec)
  t.notOk(manifest.id)

  h.start().then(() => {
    let manifest = h.manifest()
    t.ok(manifest.id)
    t.equal(manifest.process, process.pid)
    t.equal(manifest.instances.length, 0)
    h.stop()
    t.end()
  })
})

test.skip('Host.create', t => {
  t.plan(4)

  let h = new Host()

  let first
  h.create('NodeContext')
    .then(address => {
      t.ok(address)
      first = address
      return h.get(address)
    })
    .then(instance => {
      t.ok(instance)
      return h.create('NodeContext')
    })
    .then(address => {
      t.notEqual(address, first)
    })
    .catch(error => {
      t.notOk(error)
    })

  h.create('fooType')
    .then(() => {
      t.fail('should not create anything')
    })
    .catch(error => {
      t.equal(error.message, 'Unknown type: fooType')
    })
})

test('Host.get', t => {
  let h = new Host()

  h.create('NodeContext')
    .then(result => {
      let {address} = result
      t.ok(address)
      return h.get(address)
    })
    .then(instance => {
      t.ok(instance)
      return h.get('foobar')
    })
    .catch(error => {
      t.ok(error.message.match('Unknown instance'))
      t.end()
    })
})

test('Host.call', t => {
  t.plan(4)

  let h = new Host()

  h.create('NodeContext')
    .then(result => {
      let {address} = result
      t.ok(address)

      h.call(address, 'runCode', ['6*7'])
        .then(result => {
          t.deepEqual(result,{ errors: null, output: { content: '42', format: 'text', type: 'integer' } })
        })
        .catch(error => {
          t.notOk(error)
        })

      h.call(address, 'fooMethod')
        .then(() => {
          t.fail('should not return a result')
        })
        .catch(error => {
          t.equal(error.message, 'Unknown method: fooMethod')
        })
    })
    .catch(error => {
      t.notOk(error)
    })

  h.call('fooId')
    .then(() => {
      t.fail('should not return a result')
    })
    .catch(error => {
      t.ok(error.message.match('Unknown instance'))
    })
})

test('Host.delete', t => {
  let h = new Host()

  let address_
  h.create('NodeContext')
    .then(result => {
      let {address} = result
      address_ = result
      t.ok(result)
      return h.delete(result)
    })
    .then(() => {
      t.pass('sucessfully deleted')
      return h.delete(address_)
    })
    .then(() => {
      t.fail('should not be able to delete again')
      t.end()
    })
    .catch(error => {
      t.equal(error.message, `Unknown instance: ${address_}`)
      t.end()
    })
})

test('Host.start+stop+servers', t => {
  let h = new Host()

  h.start()
    .then(() => {
      t.ok(h._servers.http)
      t.deepEqual(h.servers, ['http'])
      h.stop()
        .then(() => {
          t.notOk(h._servers.http)
          t.deepEqual(h.servers, [])
          t.end()
        })
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})
