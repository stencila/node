const rimraf = require('rimraf')
const fs = require('fs')
const path = require('path')
const test = require('tape')
const FileSystemBackend = require('../../src/backend/FileSystemBackend')
const helloWorld = fs.readFileSync(
  path.join(__dirname, 'seed', 'hello-world.html'),
  'utf8'
)
const helloWorldModified = fs.readFileSync(
  path.join(__dirname, 'seed', 'hello-world-modified.html'),
  'utf8'
)
let TMP_FOLDER = path.join(__dirname, 'tmp-folder')

test('Create a new document', function (t) {
  let backend = _initBackend()
  backend.createDocument(helloWorld, 'hello-world').then(() => {
    backend.getArchive('hello-world').then((archive) => {
      archive.readFile('index.html', 'text/html').then((data) => {
        t.equal(data, helloWorld)
        // TODO: Test manifest (did title get extracted from doc properly?)
        t.end()
      })
    })
  })
})

test('Import an HTML document', function (t) {
  let backend = _initBackend()
  let filePath = path.join(__dirname, 'seed', 'hello-world.html')
  backend.importFile(filePath).then((documentId) => {
    backend.getArchive(documentId).then((archive) => {
      archive.readFile('index.html', 'text/html').then((data) => {
        t.equal(data, helloWorld)
        // TODO: Test manifest (did title get extracted from doc properly?)
        t.end()
      })
    })
  })
})

test('Saving / exporting a document', function (t) {
  let backend = _initBackend()
  backend.createDocument(helloWorld, 'hello-world').then(() => {
    return backend.getArchive('hello-world')
  }).then((archive) => {
    return archive.writeFile('index.html', 'text/html', helloWorldModified)
  }).then((archive) => {
    return backend.storeArchive(archive)
  }).then(() => {
    let updatedFile = fs.readFileSync(
      path.join(TMP_FOLDER, 'hello-world', 'storage', 'index.html'),
      'utf8'
    )
    t.equal(updatedFile, helloWorldModified)
    t.end()
  })
})

test('cleanup', function(t) {
  rimraf.sync(TMP_FOLDER)
  t.end()
})

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
