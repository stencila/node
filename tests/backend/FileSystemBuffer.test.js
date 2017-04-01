const rimraf = require('rimraf')
const fs = require('fs')
const path = require('path')
const test = require('tape')
const FileSystemBuffer = require('../../src/backend/FileSystemBuffer')

let TMP_FOLDER = path.join(__dirname, 'tmp-folder')

test('write+read: Write a text file and then read it', function (t) {
  let archive = _createEmptyFolderArchive()
  archive.writeFile('index.html', 'text/html', 'HELLO WORLD').then(() => {
    archive.readFile('index.html', 'text/html').then((fileData) => {
      t.equal(fileData, 'HELLO WORLD')
      t.end()
    })
  })
})

test('read error: Reads with errors', function (t) {
  let archive = _createEmptyFolderArchive()

  t.plan(2)

  archive.readFile('foo', 'binary')
    .then(() => {
      t.fail('shouldnt succeed')
    }).catch(error => {
      t.equal(error.message, 'FileSystemBuffer only supports reading text and json')
    })

  archive.readFile('foo', 'text/html')
    .then(() => {
      t.fail('shouldnt succeed')
    }).catch(error => {
      t.ok(error.message.match('no such file or directory'))
    })
})

test('write error: Writes with errors', function (t) {
  let archive = _createEmptyFolderArchive()

  t.plan(1)

  archive.writeFile('foo', 'bar', {})
    .then(() => {
      t.fail('shouldnt succeed')
    }).catch(error => {
      t.equal(error.message, 'FileSystemBuffer only supports writing utf-8 strings and blobs')
    })
})

test('cleanup', function(t) {
  rimraf.sync(TMP_FOLDER)
  t.end()
})

function _createEmptyFolderArchive() {
  // Clean up
  rimraf.sync(TMP_FOLDER)
  fs.mkdirSync(TMP_FOLDER)
  // Setup
  return new FileSystemBuffer(TMP_FOLDER)
}
