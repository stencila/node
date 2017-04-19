const test = require('tape')

const Host = require('../../src/host/Host')
const NodeContext = require('../../src/node-context/NodeContext')
const version = require('../../package').version

test('Host', t => {
  let h = new Host()

  t.ok(h instanceof Host)

  t.end()
})

test('Host.options', t => {
  let h = new Host()

  h.options()
    .then(manifest => {
      t.equal(manifest.stencila.package, 'node')
      t.equal(manifest.stencila.version, version)
      t.equal(manifest.instances.length, 0)
      t.deepEqual(manifest.schemes.new.NodeContext, NodeContext.spec)
      t.end()
    })
    .catch(error => {
      t.notOk(error)
      t.end()
    })
})

test('Host.post', t => {
  t.plan(4)

  let h = new Host()

  let first
  h.post('NodeContext')
    .then(id => {
      t.ok(id)
      first = id
      return h.get(id)
    })
    .then(instance => {
      t.ok(instance)
      return h.post('NodeContext')
    })
    .then(id => {
      t.notEqual(id, first)
    })
    .catch(error => {
      t.notOk(error)
    })

  h.post('fooType')
    .then(() => {
      t.fail('should not create anything')
    })
    .catch(error => {
      t.equal(error.message, 'Unknown type: fooType')
    })
})

test('Host.get', t => {
  let h = new Host()

  h.post('NodeContext')
    .then(id => {
      t.ok(id)
      return h.get(id)
    })
    .then(instance => {
      t.ok(instance)
      return h.get('foobar')
    })
    .catch(error => {
      t.equal(error.message, 'Unknown instance: foobar')
      t.end()
    })
})

test('Host.put', t => {
  t.plan(4)

  let h = new Host()

  h.post('NodeContext')
    .then(id => {
      t.ok(id)

      h.put(id, 'runCode', ['6*7'])
        .then(result => {
          t.deepEqual(result,{ errors: null, output: { content: '42', format: 'text', type: 'integer' } })
        })
        .catch(error => {
          t.notOk(error)
        })

      h.put(id, 'fooMethod')
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

  h.put('fooId')
    .then(() => {
      t.fail('should not return a result')
    })
    .catch(error => {
      t.equal(error.message, 'Unknown instance: fooId')
    })
})

test('Host.delete', t => {
  let h = new Host()

  let iid
  h.post('NodeContext')
    .then(id => {
      iid = id
      t.ok(id)
      return h.delete(id)
    })
    .then(() => {
      t.pass('sucessfully deleted')
      return h.delete(iid)
    })
    .then(() => {
      t.fail('should not be able to delete again')
      t.end()
    })
    .catch(error => {
      t.equal(error.message, `Unknown instance: ${iid}`)
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
