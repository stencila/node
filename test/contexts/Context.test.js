const test = require('tape')

const Host = require('../../lib/host/Host')
// const Context = require('../../lib/contexts/Context')

test('Context.packPointer+unpackPointer', async assert => {
  const hostA = new Host()
  const hostB = new Host()
  await hostA.start()
  await hostB.start()

  const contextA1 = (await hostA.create('Context')).instance
  const contextA2 = (await hostA.create('Context')).instance
  const contextB1 = (await hostB.create('Context')).instance

  contextA1._data['A1X'] = 'a1x'
  contextB1._data['B1X'] = 'b1x'

  const pointerA1X = await contextA1.packPointer('string', 'A1X')
  const pointerB1X = await contextB1.packPointer('string', 'B1X')
  // Simulate a pointer to data on another machine
  const pointerC1X = Object.assign({}, pointerB1X)
  pointerC1X.machine = {
    mac: 'Some other MAC',
    ip: 'Some other IP'
  }

  assert.deepEqual(pointerA1X, {
    type: 'string',
    name: 'A1X',
    context: {
      id: contextA1.id,
      name: contextA1.name
    },
    host: {
      id: hostA.id,
      port: hostA.servers.http.port
    },
    machine: {
      mac: hostA.machine.mac,
      ip: hostA.machine.ip
    }
  })

  assert.deepEqual(await contextA1.unpackPointer(pointerA1X), 'a1x', 'Accessible from same context')
  assert.deepEqual(await contextA2.unpackPointer(pointerA1X), 'a1x', 'Accessible from another context on host')
  assert.deepEqual(await contextB1.unpackPointer(pointerA1X), 'a1x', 'Accessible from another context on another host')

  assert.deepEqual(await contextA1.unpackPointer(pointerB1X), 'b1x', 'Accessible from another context on another host started before')

  async function tryCatch () {
    try {
      await contextA1.unpackPointer(pointerC1X)
    } catch (error) {
      return error.message
    }
  }
  assert.equal(await tryCatch(), 'Inter-machine pointers are not yet supported')

  await hostA.stop()
  await hostB.stop()
  assert.end()
})

test.onFinish(function () {
  process.exit()
})
