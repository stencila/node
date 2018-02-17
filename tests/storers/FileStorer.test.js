const path = require('path')
const test = require('tape')
const untildify = require('untildify')

const FileStorer = require('../../src/storers/FileStorer')

test('FileStorer', t => {
  let s = new FileStorer('.')

  t.ok(s instanceof FileStorer)
  t.end()
})

test('FileStorer.getInfo', t => {
  t.test(t => {
    let s = new FileStorer('~/some/dir')
    s.getDirectory().then(dir => {
      t.equal(dir, untildify('~/some/dir'))
      t.end()
    })
  })
})
