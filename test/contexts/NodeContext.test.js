const fs = require('fs')
const path = require('path')
const { test, testAsync } = require('../helpers')

const NodeContext = require('../../lib/contexts/NodeContext')

test('NodeContext', assert => {
  const context = new NodeContext()

  assert.ok(context instanceof NodeContext)
  assert.end()
})

testAsync('NodeContext.compileLibrary', async assert => {
  const context = new NodeContext()
  const libtest = path.join(__dirname, 'fixtures', 'libtest')

  await context.compileLibrary({src: libtest, minify: false})
  assert.equal(
    fs.readFileSync(path.join(libtest, 'libtest.js'), 'utf8'),
    fs.readFileSync(path.join(libtest, 'expected-libtest.js'), 'utf8')
  )

  await context.compileLibrary({src: libtest})
  assert.ok(
    fs.statSync(path.join(libtest, 'libtest.min.js'))
  )

  assert.end()
})

testAsync('NodeContext.executeLibrary', async assert => {
  const context = new NodeContext()
  const libtest = path.join(__dirname, 'fixtures', 'libtest')

  await context.executeLibrary({src: libtest, name: 'libtest'})
  const libs = await context.libraries()
  assert.deepEqual(Object.keys(libs), ['libtest'])

  assert.end()
})
