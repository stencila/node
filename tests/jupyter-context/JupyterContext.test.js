const test = require('tape')

const JupyterContext = require('../../src/jupyter-context/JupyterContext')

test('JupyterContext.initialize', t => {
  JupyterContext.initialize().then(() => {
    // At this stage, not a formal test cause that would need one or more Kernels to be installed
    // on this machine
    t.pass('JupyterContext.spec.kernels: ' + JSON.stringify(Object.keys(JupyterContext.spec.kernels)))
    // If at least one kernel insalled can continue
    if (Object.keys(JupyterContext.spec.kernels).length >= 1) {
      t.test('JupyterContext', t => {
        let c = new JupyterContext(null, false)
        
        t.pass('JupyterContext.kernel: ' + c.kernel)
        c.start().then(() => {
          t.pass('JupyterContext.config: ' + JSON.stringify(c.config))
          t.ok(c._connectionFile)
          t.ok(c._process)
          return c.stop()
        }).then(() => {
          t.end()
        })
      })
    } else {
      t.end()
    }
  }).catch(error => {
    t.error(error)
    t.end()
  })
})

// Do this to prevent the test process waiting for spawned child
// e.g. For some reason the [irkernel](https://github.com/IRkernel/IRkernel)
// does not get killed by `child.kill()` and so hangs this process
test.onFinish(function () {
  process.exit()
})
