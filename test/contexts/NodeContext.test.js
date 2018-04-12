const fs = require('fs')
const path = require('path')
const test = require('tape')

const NodeContext = require('../../lib/contexts/NodeContext')

test('NodeContext', assert => {
  let context = new NodeContext()

  assert.ok(context instanceof NodeContext)
  assert.end()
})

test('NodeContext.compileLibrary', async assert => {
  let context = new NodeContext()

  const libtest = path.join(__dirname, 'fixtures', 'libtest')

  await context.compileLibrary(libtest, null, false)
  assert.equal(
    fs.readFileSync(path.join(libtest, 'libtest.js'), 'utf8'),
    fs.readFileSync(path.join(libtest, 'expected-libtest.js'), 'utf8')
  )

  await context.compileLibrary(libtest, null)
  assert.ok(
    fs.statSync(path.join(libtest, 'libtest.min.js'))
  )

  assert.end()
})
