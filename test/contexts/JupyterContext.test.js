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
    
  let context = new JupyterContext({
    language: 'python',
    debug: true,
    timeout: 5
  })

  assert.pass('JupyterContext.kernel: ' + context.kernel)
  
  await context.initialize()
  assert.pass('JupyterContext._config: ' + JSON.stringify(context._config))
  assert.pass('JupyterContext._kernelInfo: ' + JSON.stringify(context._kernelInfo))
  assert.ok(context._connectionFile)
  assert.ok(context._process)

  let cell

  // Expression
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

  // Expression with runtime error
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

  // Block
  cell = await context.execute('print(22)\n6 * 7\n')
  assert.deepEqual(cell.outputs[0], {
    value: { type: 'number', data: 42 }
  })

  // Block with error
  cell = await context.execute('foo')
  assert.deepEqual(cell.messages, [
    { type: 'error', message: 'NameError: name \'foo\' is not defined' }
  ])

  await context.finalize()
  assert.end()
})
