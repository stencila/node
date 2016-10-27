const fs = require('fs')
const path = require('path')
const tmp = require('tmp')
const test = require('tape')

const Component = require('../../src/component/Component')
require('../../src/host/Host')

test('Component can be constructed', function (t) {
  let c = new Component()

  t.ok(c instanceof Component)
  t.end()
})

test('Component has an id', function (t) {
  let c = new Component()

  t.equal(c.id.length, 64)
  t.end()
})

test('Component address is lengthend on construction', function (t) {
  t.equal((new Component('/dir')).address, 'file:///dir')
  t.end()
})

test('Component address defaults to id scheme', function (t) {
  let c = new Component()
  t.equal(c.address, `id://${c.id}`)
  t.end()
})

test('Component address can be lengthened', function (t) {
  let c = new Component()

  t.equal(c.lengthen('new://document'), 'new://document')
  t.equal(c.lengthen('ftp://foo/bar'), 'ftp://foo/bar')
  t.equal(c.lengthen('+document'), 'new://document')
  t.equal(c.lengthen('~aaaaaaaa'), 'id://aaaaaaaa')
  t.equal(c.lengthen('./report.docx'), 'file://' + process.cwd() + '/report.docx')
  t.equal(c.lengthen('https://foo.com/report.md'), 'https://foo.com/report.md')
  t.equal(c.lengthen('bb/foo/bar/report.md'), 'git://bitbucket.org/foo/bar/report.md')
  t.equal(c.lengthen('gh/foo/bar/report.md'), 'git://github.com/foo/bar/report.md')
  t.equal(c.lengthen('gl/foo/bar/report.md'), 'git://gitlab.com/foo/bar/report.md')
  t.equal(c.lengthen('stats/t-test'), 'git://stenci.la/stats/t-test')
  t.end()
})

test('Component address can be shortened', function (t) {
  let c = new Component()

  t.equal(c.shorten('new://document'), '+document')
  t.equal(c.shorten('id://aaaaaaaa'), '~aaaaaaaa')
  t.equal(c.shorten('file://report.docx'), 'file://report.docx')
  t.equal(c.shorten('https://foo.com/report.md'), 'https://foo.com/report.md')
  t.equal(c.shorten('git://bitbucket.org/foo/bar/report.md'), 'bb/foo/bar/report.md')
  t.equal(c.shorten('git://github.com/foo/bar/report.md'), 'gh/foo/bar/report.md')
  t.equal(c.shorten('git://gitlab.com/foo/bar/report.md'), 'gl/foo/bar/report.md')
  t.equal(c.shorten('git://stenci.la/stats/t-test'), 'stats/t-test')
  t.end()
})

test('Component address can be lengthened and then shortened', function (t) {
  let c = new Component()
  let ls = (address) => {
    return c.shorten(c.lengthen(address))
  }

  t.equal(ls('+document'), '+document')
  t.equal(ls('new://document'), '+document')
  t.equal(ls('~aaaaaaaa'), '~aaaaaaaa')
  t.equal(ls('id://aaaaaaaa'), '~aaaaaaaa')
  t.equal(ls('gh/foo/bar/report.md'), 'gh/foo/bar/report.md')
  t.equal(ls('gh/foo/bar/report.md@1.1.0'), 'gh/foo/bar/report.md@1.1.0')
  t.end()
})

test('Component address can be split', function (t) {
  let c = new Component()

  t.deepEqual(c.split('+document'), {scheme: 'new', path: 'document', format: null, version: null})
  t.deepEqual(c.split('~aaaaaaaa'), {scheme: 'id', path: 'aaaaaaaa', format: null, version: null})
  t.deepEqual(c.split('stats/t-test'), {scheme: 'git', path: 'stenci.la/stats/t-test', format: null, version: null})
  t.deepEqual(c.split('stats/t-test@1.1.0'), {scheme: 'git', path: 'stenci.la/stats/t-test', format: null, version: '1.1.0'})
  t.end()
})

test.skip('Component can be read and written', function (t) {
  let p1 = tmp.fileSync().name
  let p2 = tmp.fileSync().name

  let c = new Component(null, p1)
  t.equal(c.path, p1, 'Initial path is set')

  c.read()
  t.equal(c.path, p1, 'Read with no arg does not change path')

  c.read(p2)
  t.equal(c.path, p2, 'Read with arg does change path')

  c.write()
  t.equal(c.path, p2, 'Write with no arg does not change path')

  c.write(p1)
  t.equal(c.path, p1, 'Write with arg does change path')

  t.end()
})

test.skip('Component read errors correctly', function (t) {
  let c = new Component('foo/bar')

  t.equal(c.path, 'foo/bar', 'Initial path is set and doesnt matter if it doesnt exist')
  t.throws(c.read.bind(c), /Filesystem path does not exist/, 'Explicit read should error')
  t.end()
})

test.skip('Component writer creates the right directories', function (t) {
  let dir = tmp.dirSync().name

  let file = path.join(dir, 'bar', 'boop.txt')
  let c = new Component(file)
  t.equal(c.path, file, 'Path is set')
  c.write()
  t.ok(fs.statSync(path.join(dir, 'bar')), 'Parent directory is created')
  t.throws(() => fs.statSync(file), 'File is not written')

  let dir2 = path.join(dir, 'bee')
  c.write(dir2)
  t.equal(c.path, dir2, 'Path is set')
  t.ok(fs.statSync(dir2), 'Directory is written')

  t.end()
})

test.skip('Component can be viewed in browser', function (t) {
  let c = new Component()

  c.view()
  t.end()
})

