const testPromise = require('../helpers').testPromise

const JupyterContext = require('../../lib/contexts/JupyterContext')

testPromise('JupyterContext.setup', assert => {
  return JupyterContext.discover().then(() => {
    assert.pass('JupyterContext.spec.kernels: ' + JSON.stringify(Object.keys(JupyterContext.spec.kernels)))

    // If at least one kernel insalled can continue
    if (Object.keys(JupyterContext.spec.kernels).length >= 1) {
      assert.test('JupyterContext', t => {
        let context = new JupyterContext({
          kernel: 'python3',
          debug: true,
          timeout: 10
        })

        assert.pass('JupyterContext.kernel: ' + context.kernel)
        context.initialize().then(() => {
          assert.pass('JupyterContext._config: ' + JSON.stringify(context._config))
          assert.pass('JupyterContext._kernelInfo: ' + JSON.stringify(context._kernelInfo))
          assert.ok(context._connectionFile)
          assert.ok(context._process)
        }).then(() => {
          // eval
          return context.executeEval({
            type: 'eval',
            source: {
              type: 'string',
              data: '2 * 2 - 1'
            }
          }).then((result) => {
            assert.deepEqual(result, {
              value: { type: 'number', data: 3 },
              messages: []
            })
          })
        }).then(() => {
          // eval with runtime error
          return context.executeEval({
            type: 'eval',
            source: {
              type: 'string',
              data: '1 + foo'
            }
          }).then((result) => {
            assert.deepEqual(result, {
              value: null,
              messages: [{ type: 'error', message: 'NameError: name \'foo\' is not defined' }]
            })
          })
        }).then((result) => {
          // run
          return context.executeRun({
            type: 'run',
            source: {
              type: 'string',
              data: 'print(22)\n6 * 7\n'
            }
          }).then((result) => {
            assert.deepEqual(result, {
              value: { type: 'number', data: 42 },
              messages: []
            })
          })
        }).then((result) => {
          // run with error
          return context.executeRun({
            type: 'run',
            source: {
              type: 'string',
              data: 'foo'
            }
          }).then((result) => {
            assert.deepEqual(result, {
              value: null,
              messages: [{ type: 'error', message: 'NameError: name \'foo\' is not defined' }]
            })
          })
        }).then((result) => {
          // run with timeout
          return context.executeRun({
            type: 'run',
            source: {
              type: 'string',
              data: 'import time\ntime.sleep(30)\n'
            }
          }).then((result) => {
            assert.deepEqual(result, {
              value: null,
              messages: [{ type: 'error', message: 'Request timed out' }]
            })
          })
        }).then(() => {
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
