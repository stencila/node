const test = require('tape')

const Host = require('../../lib/host/Host')
const NodeContext = require('../../lib/contexts/NodeContext')
const version = require('../../package').version

test('Host', t => {
  let h = new Host()

  t.ok(h instanceof Host)

  t.end()
})

test('Host.manifest', t => {
  let h = new Host()

  h.manifest().then(manifest => {
    t.equal(manifest.stencila.package, 'node')
    t.equal(manifest.stencila.version, version)
    t.deepEqual(manifest.types.NodeContext, NodeContext.spec)
    t.notOk(manifest.id)
    return h.start()
  }).then(() => {
    return h.manifest()
  }).then(manifest => {
    t.ok(manifest.id)
    t.equal(manifest.process.pid, process.pid)
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
    .then(id => {
      t.ok(id)
      first = id
      return h.get(id)
    })
    .then(instance => {
      t.ok(instance)
      return h.create('NodeContext')
    })
    .then(id => {
      t.notEqual(id, first)
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
      let {id} = result
      t.ok(id)
      return h.get(id)
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

test.skip('Host.call', t => {
  t.plan(4)

  let h = new Host()

  h.create('NodeContext')
    .then(result => {
      let {id} = result
      t.ok(id)

      h.call(id, 'runCode', ['6*7'])
        .then(result => {
          t.deepEqual(result, { errors: null, output: { content: '42', format: 'text', type: 'integer' } })
        })
        .catch(error => {
          t.notOk(error)
        })

      h.call(id, 'fooMethod')
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

  let id_
  h.create('NodeContext')
    .then(result => {
      let {id} = result
      id_ = id
      t.ok(result)
      return h.delete(id)
    })
    .then(() => {
      t.pass('sucessfully deleted')
      return h.delete(id_)
    })
    .then(() => {
      t.fail('should not be able to delete again')
      t.end()
    })
    .catch(error => {
      t.equal(error.message, `Unknown instance: ${id_}`)
      t.end()
    })
})

test('Host.start+stop+servers', t => {
  let h = new Host()

  h.start()
    .then(() => {
      t.ok(h._servers.http)
      let http = h.servers['http']
      t.ok(http.url)
      t.ok(http.key)
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
