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
    t.ok(manifest.id)
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
      let {name} = result
      t.ok(name)
      return h.get(name)
    })
    .then(repr => {
      t.ok(repr)
      return h.get('foobar')
    })
    .catch(error => {
      t.equal(error.message, 'No instance found with name "foobar"')
      t.end()
    })
})

test.skip('Host.call', t => {
  t.plan(4)

  let h = new Host()

  h.create('NodeContext')
    .then(result => {
      let {name} = result
      t.ok(name)

      h.call(name, 'runCode', ['6*7'])
        .then(result => {
          t.deepEqual(result, { errors: null, output: { content: '42', format: 'text', type: 'integer' } })
        })
        .catch(error => {
          t.notOk(error)
        })

      h.call(name, 'fooMethod')
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
      t.ok(http.address)
      t.ok(http.port)
      t.ok(http.url)
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
