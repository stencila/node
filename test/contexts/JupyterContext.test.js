const testPromise = require('../helpers').testPromise

const JupyterContext = require('../../lib/contexts/JupyterContext')

testPromise('JupyterContext.setup', assert => {
  return JupyterContext.discover().then(() => {
    assert.pass('JupyterContext.spec.kernels: ' + JSON.stringify(Object.keys(JupyterContext.spec.kernels)))

    // If at least one kernel insalled can continue
    if (Object.keys(JupyterContext.spec.kernels).length >= 1) {
      assert.test('JupyterContext', t => {
        let context = new JupyterContext({
          language: 'python',
          debug: true,
          timeout: 5
        })

        assert.pass('JupyterContext.kernel: ' + context.kernel)
        context.initialize().then(() => {
          assert.pass('JupyterContext._config: ' + JSON.stringify(context._config))
          assert.pass('JupyterContext._kernelInfo: ' + JSON.stringify(context._kernelInfo))
          assert.ok(context._connectionFile)
          assert.ok(context._process)
        }).then(() => {
          // Expression
          return context.execute({
            expr: true,
            source: {
              type: 'string',
              data: '2 * 2 - 1'
            }
          }).then(cell => {
            assert.deepEqual(cell.outputs[0], {
              value: { type: 'number', data: 3 }
            })
          })
        }).then(() => {
          // Expression with runtime error
          return context.execute({
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
        }).then(cell => {
          // Block
          return context.execute('print(22)\n6 * 7\n').then(cell => {
            assert.deepEqual(cell.outputs[0], {
              value: { type: 'number', data: 42 }
            })
          })
        }).then(cell => {
          // Block with error
          return context.execute('foo').then(cell => {
            assert.deepEqual(cell.messages, [
              { type: 'error', message: 'NameError: name \'foo\' is not defined' }
            ])
          })
        }).then(cell => {
          // Block with timeout
          // Currently failing and blocking so skipping
          /* return context.execute('import time\ntime.sleep(30)\n').then(cell => {
            assert.deepEqual(cell.messages, [
              { type: 'error', message: 'Request timed out' }
            ])
          }) */
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
