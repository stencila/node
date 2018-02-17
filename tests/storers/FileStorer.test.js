const path = require('path')
const test = require('tape')
const untildify = require('untildify')
const testPromise = require('../helpers.js').testPromise

const FileStorer = require('../../src/storers/FileStorer')

test('FileStorer', t => {
  let s = new FileStorer('.')

  t.ok(s instanceof FileStorer)
  t.end()
})

testPromise('FileStorer.getDirectory', t => {
  var testDir = path.join(__dirname, '../fixtures/test-dir-1')
  let s = new FileStorer(testDir)
  return s.getDirectory().then(dir => {
    t.equal(dir, untildify(testDir))
    t.end()
  })
})

testPromise('FileStorer.readdir', t => {
  let s = new FileStorer(path.join(__dirname, '../fixtures'))
  return s.readdir('test-dir-1').then(info => {
    t.deepEqual(info, ['file-a.txt'])
    t.end()
  })
})

testPromise('FileStorer.readdir', t => {
  let s = new FileStorer(path.join(__dirname, '../fixtures/test-dir-1'))
  return s.readdir('.').then(info => {
    t.deepEqual(info, ['file-a.txt'])
    t.end()
  })
})
