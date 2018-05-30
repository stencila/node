const os = require('os')
const { testAsync } = require('../helpers')

const Host = require('../../lib/host/Host')

testAsync('Context.packPointer+unpackPointer', async assert => {
  const hostA = new Host()
  const hostB = new Host()
  await hostA.start()
  await hostB.start()
  await hostA.discoverPeers() // To ensure `hostA` has a key for `hostB`

  const contextA1 = (await hostA.create('NodeContext')).instance
  const contextA2 = (await hostA.create('NodeContext')).instance
  const contextB1 = (await hostB.create('NodeContext')).instance

  contextA1._variables['A1X'] = 'a1x'
  contextB1._variables['B1X'] = 'b1x'

  const pointerA1X = await contextA1.packPointer({type: 'string', name: 'A1X'})
  const pointerB1X = await contextB1.packPointer({type: 'string', name: 'B1X'})

  assert.deepEqual(pointerA1X, {
    type: 'string',
    path: {
      value: {
        id: pointerA1X.path.value.id,
        name: 'A1X'
      },
      context: {
        id: contextA1.id,
        name: contextA1.name
      },
      host: {
        id: hostA.id,
        port: hostA.servers.http.port
      },
      machine: {
        id: hostA.machine.id,
        ip: hostA.machine.ip
      }
    },
    preview: null
  })

  assert.deepEqual(await contextA1.unpackPointer(pointerA1X), 'a1x', 'Accessible from same context')
  assert.deepEqual(await contextA2.unpackPointer(pointerA1X), 'a1x', 'Accessible from another context on host')
  assert.deepEqual(await contextB1.unpackPointer(pointerA1X), 'a1x', 'Accessible from another context on another host')

  if (os.platform() === 'linux') {
    assert.deepEqual(await contextA1.unpackPointer(pointerB1X), 'b1x', 'Accessible from another context on another host started before')
  }

  // Simulate a pointer to data on another machine
  const pointerC1X = Object.assign({}, pointerB1X)
  pointerC1X.path.machine = {
    id: 'Some other id',
    ip: 'Some other IP'
  }
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
