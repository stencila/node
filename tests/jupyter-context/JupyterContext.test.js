const test = require('tape')

const JupyterContext = require('../../src/jupyter-context/JupyterContext')

test('JupyterContext.initialize', t => {
  JupyterContext.initialize().then(() => {
    // At this stage, not a formal test cause that would need one or more Kernels to be installed
    // on this machine
    t.pass('JupyterContext.spec.aliases: ' + JSON.stringify(JupyterContext.spec.aliases))
    t.end()
  }).catch(error => {
    t.error(error)
    t.end()
  })
})

test('JupyterContext', t => {
  let c = new JupyterContext()

  t.ok(c instanceof JupyterContext)
  t.end()
})
