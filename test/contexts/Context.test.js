const test = require('tape')

const Host = require('../../lib/host/Host')
// const Context = require('../../lib/contexts/Context')

test.skip('Context.packPointer+unpackPointer', async assert => {
  const hostA = new Host()
  const hostB = new Host()
  await hostA.start()
  await hostB.start()
  let m = await hostA.manifest()
  hostB._peers.push(m)

  const contextA1 = (await hostA.create('Context')).instance
  const contextA2 = (await hostA.create('Context')).instance
  const contextB1 = (await hostB.create('Context')).instance

  contextA1._data['fourty_two'] = 42

  const pointerA1 = await contextA1.packPointer('number', 'fourty_two')
  assert.deepEqual(pointerA1, {
    type: 'number',
    name: 'fourty_two',
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

  const dataA1 = await contextA1.unpackPointer(pointerA1)
  assert.deepEqual(dataA1, 42)

  const dataA2 = await contextA2.unpackPointer(pointerA1)
  assert.deepEqual(dataA2, 42)

  const dataB1 = await contextB1.unpackPointer(pointerA1)
  assert.deepEqual(dataB1, 42)

  await hostA.stop()
  await hostB.stop()
  assert.end()
})

test.onFinish(function () {
  process.exit()
})
