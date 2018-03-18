const testPromise = require('../helpers').testPromise

const JupyterContext = require('../../lib/contexts/JupyterContext')

testPromise('JupyterContext.setup', assert => {
  return JupyterContext.setup().then(() => {
    // At this stage, not a formal test cause that would need one or more Kernels to be installed
    // on this machine
    assert.pass('JupyterContext.spec.kernels: ' + JSON.stringify(Object.keys(JupyterContext.spec.kernels)))
    // If at least one kernel insalled can continue
    if (Object.keys(JupyterContext.spec.kernels).length >= 1) {
      assert.test('JupyterContext', t => {
        let context = new JupyterContext()

        assert.pass('JupyterContext.kernel: ' + context.kernel)
        context.initialize().then(() => {
          assert.pass('JupyterContext.config: ' + JSON.stringify(context.config))
          assert.ok(context._connectionFile)
          assert.ok(context._process)
        }).then(() => {
          return context.executeEval({
            type: 'eval',
            source: {
              type: 'string',
              data: '2 * 2 -1'
            }
          })
        }).then((result) => {
          assert.deepEqual(result, {
            type: 'number',
            data: 3
          })

          return context.executeRun({
            type: 'run',
            source: {
              type: 'string',
              data: 'print(22)\n6 * 7\n'
            }
          })
        }).then((result) => {
          assert.deepEqual(result, {
            type: 'number',
            data: 42
          })

          return context.finalize()
        }).then(() => {
          assert.end()
        })
      })
    } else {
      assert.end()
    }
  })
})
