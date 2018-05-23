const { testAsync } = require('../helpers')

const JupyterContext = require('../../lib/contexts/JupyterContext')

testAsync('JupyterContext', async assert => {
  await JupyterContext.discover()

  // These tests can only be run if at least one Jupyter kernel is installed
  assert.pass('JupyterContext.spec.kernels: ' + JSON.stringify(Object.keys(JupyterContext.spec.kernels)))
  if (Object.keys(JupyterContext.spec.kernels).length < 1) {
    assert.end()
    return
  }

  let context = new JupyterContext(null, 'jupyterContext1', {
    language: 'python',
    debug: false,
    timeout: 5
  })

  assert.pass('JupyterContext.kernel: ' + context.kernel)

  await context.initialize()
  assert.pass('JupyterContext._config: ' + JSON.stringify(context._config))
  assert.pass('JupyterContext._kernelInfo: ' + JSON.stringify(context._kernelInfo))
  assert.ok(context._connectionFile)
  assert.ok(context._process)

  let cell

  // Execute expression
  cell = await context.execute({
    expr: true,
    source: {
      type: 'string',
      data: '2 * 2 - 1'
    }
  })
  assert.deepEqual(cell.outputs[0], {
    value: { type: 'number', data: 3 }
  })

  // Execute expression with runtime error
  cell = await context.execute({
    expr: true,
    source: {
      type: 'string',
      data: '1 + foo'
    }
  }).then(cell => {
    assert.deepEqual(cell.messages, [
      { type: 'error', message: 'NameError: name \'foo\' is not defined' }
    ])
  })

  // Execute block returning a JSONable console result
  cell = await context.execute('print(22)\n6 * 7\n')
  assert.deepEqual(cell.outputs[0], {
    value: { type: 'number', data: 42 }
  })

  // Execute block returning a non-JSONable console result
  cell = await context.execute('import datetime\ndatetime.datetime(2018, 5, 23)\n')
  assert.deepEqual(cell.outputs[0], {
    value: { type: 'string', data: 'datetime.datetime(2018, 5, 23, 0, 0)' }
  })

  // Execute block returning an image
  cell = await context.execute(`
import matplotlib.pyplot as plt
plt.scatter([1, 2, 3], [1, 2, 3])
plt.show()
`)
  // Without `%matplotlib inline` magic we get a text rep
  assert.ok(cell.outputs[0].value.data.match(/^<matplotlib\.figure\.Figure/))

  cell = await context.execute(`
%matplotlib inline
plt.show()
`)
  // Adding `%matplotlib inline` currently doesn't work as expected
  // assert.equal(cell.outputs[0].value.type, 'image')

  // Execute block with error
  cell = await context.execute('foo')
  assert.deepEqual(cell.messages, [
    { type: 'error', message: 'NameError: name \'foo\' is not defined' }
  ])

  await context.finalize()
  assert.end()
})
