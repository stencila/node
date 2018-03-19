const test = require('tape')

const NodeContext = require('../../lib/contexts/NodeContext')

test.skip('NodeContext', function (t) {
  let c = new NodeContext()

  t.plan(4)

  t.ok(c instanceof NodeContext)

  c.runCode('foo = "bar"')
    .then(() => {
      c.runCode('foo + "t_simpson"')
        .then(result => {
          t.deepEqual(result, {errors: null, output: c.pack('bart_simpson')})
        })
    })

  c.callCode('return a*6', {a: c.pack(7)}).then(result => {
    t.deepEqual(result, {errors: null, output: c.pack(42)})
  })

  c.codeDependencies('foo').then(result => t.deepEqual(result, ['foo']))
})
