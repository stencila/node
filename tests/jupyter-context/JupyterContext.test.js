const test = require('tape')
const {pack} = require('stencila').value

const JupyterContext = require('../../src/jupyter-context/JupyterContext')

test('JupyterContext', t => {
  let c = new JupyterContext()

  t.plan(4)

  t.ok(c instanceof JupyterContext)

  c.runCode('foo = "bar"')
    .then(() => {
      c.runCode('foo + "t_simpson"')
        .then(result => {
          t.deepEqual(result, {errors: null, output: pack('bart_simpson')})
        })
    })

  c.callCode('return a*6', {a: pack(7)})
    .then(result => {
      t.deepEqual(result, {errors: null, output: pack(42)})
    })

  c.codeDependencies('foo')
    .then(result => {
      t.deepEqual(result, ['foo'])
    })
})
