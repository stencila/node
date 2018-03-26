const test = require('tape')

const Host = require('../../lib/host/Host')
const NodeContext = require('../../lib/contexts/NodeContext')
const version = require('../../package').version

test('Host', assert => {
  const host = new Host()

  assert.ok(host instanceof Host)

  assert.end()
})

test('Host.manifest', async assert => {
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

test('Host.create', async assert => {
  const host = new Host()

  let instance1 = await host.create('NodeContext')
  assert.ok(await host.get(instance1.name))

  let instance2 = await host.create('NodeContext')
  assert.notEqual(instance2.name, instance1.name)

  try {
    await host.create('fooType')
  } catch (error) {
    assert.equal(error.message, 'No type with name "fooType"')
  }

  assert.end()
})

test('Host.get', async assert => {
  const host = new Host()

  let instance = await host.create('NodeContext')
  assert.ok(await host.get(instance.name))

  try {
    await host.get('foobar')
  } catch (error) {
    assert.equal(error.message, 'No instance with name "foobar"')
  }

  assert.end()
})

test('Host.call', async assert => {
  const host = new Host()

  let {name} = await host.create('Context')
  assert.ok(name)

  let result = await host.call(name, 'pack', 42)
  assert.deepEqual(result, {type: 'number', data: 42})

  try {
    await host.call(name, 'fooMethod')
  } catch (error) {
    assert.equal(error.message, 'No method with name "fooMethod"')
  }

  try {
    await host.call('fooName')
  } catch (error) {
    assert.equal(error.message, 'No instance with name "fooName"')
  }

  assert.end()
})

test('Host.delete', async assert => {
  const host = new Host()

  let {name} = await host.create('NodeContext')
  await host.delete(name)

  try {
    await host.get(name)
  } catch (error) {
    assert.equal(error.message, `No instance with name "${name}"`)
  }

  try {
    await host.delete(name)
  } catch (error) {
    assert.equal(error.message, `No instance with name "${name}"`)
  }

  assert.end()
})

test('Host.start+stop+servers', async assert => {
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
