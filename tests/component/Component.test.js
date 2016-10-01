const fs = require('fs')
const path = require('path')
const tmp = require('tmp')
const test = require('tape')

const Component = require('../../src/component/Component')

test('Component can be constructed', function (t) {
  let c = new Component()

  t.ok(c instanceof Component)
  t.end()
})

test('Component can be read and written', function (t) {
  let p1 = tmp.fileSync().name
  let p2 = tmp.fileSync().name

  let c = new Component(p1)
  t.equal(c.path(), p1, 'Initial path is set')

  c.read()
  t.equal(c.path(), p1, 'Read with no arg does not change path')

  c.read(p2)
  t.equal(c.path(), p2, 'Read with arg does change path')

  c.write()
  t.equal(c.path(), p2, 'Write with no arg does not change path')

  c.write(p1)
  t.equal(c.path(), p1, 'Write with arg does change path')

  t.end()
})

test('Component read errors correctly', function (t) {
  let c = new Component('foo/bar')
  t.equal(c.path(), 'foo/bar', 'Initial path is set and doesnt matter if it doesnt exist')
  t.throws(c.read.bind(c), /Filesystem path does not exist/, 'Explicit read should error')

  t.end()
})

test('Component writer creates the right directories', function (t) {
  let dir = tmp.dirSync().name

  let file = path.join(dir, 'bar', 'boop.txt')
  let c = new Component(file)
  t.equal(c.path(), file, 'Path is set')
  c.write()
  t.ok(fs.statSync(path.join(dir, 'bar')), 'Parent directory is created')
  t.throws(() => fs.statSync(file), 'File is not written')

  let dir2 = path.join(dir, 'bee')
  c.write(dir2)
  t.equal(c.path(), dir2, 'Path is set')
  t.ok(fs.statSync(dir2), 'Directory is written')

  t.end()
})
