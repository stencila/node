const test = require('tape')

const JupyterContext = require('../../lib/contexts/JupyterContext')

test('JupyterContext.setup', t => {
  JupyterContext.setup().then(() => {
    // At this stage, not a formal test cause that would need one or more Kernels to be installed
    // on this machine
    t.pass('JupyterContext.spec.kernels: ' + JSON.stringify(Object.keys(JupyterContext.spec.kernels)))
    // If at least one kernel insalled can continue
    if (Object.keys(JupyterContext.spec.kernels).length >= 1) {
      t.test('JupyterContext', t => {
        let c = new JupyterContext()

        t.pass('JupyterContext.kernel: ' + c.kernel)
        c.initialize().then(() => {
          t.pass('JupyterContext.config: ' + JSON.stringify(c.config))
          t.ok(c._connectionFile)
          t.ok(c._process)
          return c.finalize()
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
