const fs = require('fs')
const path = require('path')
const test = require('tape')

const NodeContext = require('../../lib/contexts/NodeContext')

test('NodeContext', assert => {
  const context = new NodeContext()

  assert.ok(context instanceof NodeContext)
  assert.end()
})

test('NodeContext.compileLibrary', async assert => {
  const context = new NodeContext()
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

test('NodeContext.executeLibrary', async assert => {
  const context = new NodeContext()
  const libtest = path.join(__dirname, 'fixtures', 'libtest')

  await context.executeLibrary(libtest, 'libtest')
  const libs = await context.libraries()
  assert.deepEqual(Object.keys(libs), ['local', 'libtest'])

  assert.end()
})
