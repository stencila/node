const rimraf = require('rimraf')
const fs = require('fs')
const path = require('path')
const test = require('tape')
const FileSystemBackend = require('../../src/backend/FileSystemBackend')
const helloWorld = require('./seed/helloWorld')
let TMP_FOLDER = path.join(__dirname, 'tmp-folder')

test('import: Create a new document', function (t) {
  let backend = _initBackend()
  backend.createDocument(helloWorld, 'hello-world').then(() => {
    backend.getArchive('hello-world').then((archive) => {
      archive.readFile('index.html', 'text/html').then((data) => {
        t.equal(data, helloWorld)
        console.log('hello')
        // TODO: Test manifest (did title get extracted from doc properly?)
        t.end()
      })
    })
  })
})

// test('cleanup', function(t) {
//   rimraf.sync(TMP_FOLDER)
//   t.end()
// })

/*
  Creates an empty library
*/
function _initBackend() {
  // Clean up
  rimraf.sync(TMP_FOLDER)
  fs.mkdirSync(TMP_FOLDER)

  // Create empty library file
  fs.writeFileSync(path.join(TMP_FOLDER, 'library.json'), '{}', 'utf8')
  return new FileSystemBackend(TMP_FOLDER)
}
