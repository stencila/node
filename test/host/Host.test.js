const fs = require('fs')
const path = require('path')
const { test, testAsync } = require('../helpers')

const Host = require('../../lib/host/Host')
const NodeContext = require('../../lib/contexts/NodeContext')
const version = require('../../package').version

test('Host', assert => {
  const host = new Host()

  assert.ok(host instanceof Host)

  assert.end()
})

testAsync('Host.register', async assert => {
  const host = new Host()

  await host.register()
  let manifest = JSON.parse(
    fs.readFileSync(path.join(Host.userDir(), 'hosts', 'node.json'))
  )
  assert.equal(manifest.id, host.id)

  assert.end()
})

testAsync('Host.environs', async assert => {
  const host = new Host()

  let environs = await host.environs()
  assert.deepEqual(environs[0], {
    id: 'local',
    name: 'local',
    version: null
  })

  assert.end()
})

testAsync('Host.manifest', async assert => {
  const host = new Host()

  let manifest

  manifest = await host.manifest()
  assert.equal(manifest.stencila.package, 'node')
  assert.equal(manifest.stencila.version, version)
  assert.deepEqual(manifest.types.NodeContext, NodeContext.spec)
  assert.ok(manifest.id)

  await host.start()

  manifest = await host.manifest()
  assert.ok(manifest.id)
  assert.equal(manifest.process.pid, process.pid)
  assert.equal(manifest.instances.length, 0)

  await host.stop()
  assert.end()
})

testAsync('Host.create', async assert => {
  const host = new Host()

  let instance1 = await host.create('NodeContext')
  assert.ok(await host.get(instance1.id))

  let instance2 = await host.create('NodeContext')
  assert.notEqual(instance2.id, instance1.id)

  try {
    await host.create('fooType')
  } catch (error) {
    assert.equal(error.message, 'No type with name "fooType"')
  }

  assert.end()
})

testAsync('Host.get', async assert => {
  const host = new Host()

  let instance = await host.create('NodeContext')
  assert.ok(await host.get(instance.id))

  try {
    await host.get('foobar')
  } catch (error) {
    assert.equal(error.message, 'No instance with id "foobar"')
  }

  assert.end()
})

testAsync('Host.call', async assert => {
  const host = new Host()

  let {id} = await host.create('NodeContext')
  assert.ok(id)

  let result = await host.call(id, 'pack', 42)
  assert.deepEqual(result, {type: 'number', data: 42})

  try {
    await host.call(id, 'fooMethod')
  } catch (error) {
    assert.equal(error.message, `Instance "${id}" has no method "fooMethod"`)
  }

  try {
    await host.call('fooName')
  } catch (error) {
    assert.equal(error.message, 'No instance with id "fooName"')
  }

  assert.end()
})

testAsync('Host.destroy', async assert => {
  const host = new Host()

  let {id} = await host.create('NodeContext')
  await host.destroy(id)

  try {
    await host.get(id)
  } catch (error) {
    assert.equal(error.message, `No instance with id "${id}"`)
  }

  try {
    await host.destroy(id)
  } catch (error) {
    assert.equal(error.message, `No instance with id "${id}"`)
  }

  assert.end()
})

testAsync('Host.start+stop+servers', async assert => {
  const host = new Host()

  await host.start()
  let http = host.servers['http']
  assert.ok(http)
  assert.ok(http.address)
  assert.ok(http.port)
  assert.ok(http.url)

  await host.stop()
  assert.notOk(host._servers.http)
  assert.deepEqual(host.servers, [])

  assert.end()
})
