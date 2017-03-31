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
    backend.getBuffer('hello-world').then((buffer) => {
      buffer.readFile('index.html', 'text/html').then((data) => {
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
    backend.getBuffer(documentId).then((buffer) => {
      buffer.readFile('index.html', 'text/html').then((data) => {
        t.equal(data, helloWorld)
        // TODO: Test manifest (did title get extracted from doc properly?)
        t.end()
      })
    })
  })
})

test('List documents', function (t) {
  let backend = _initBackend()
  backend.createDocument('content', 'my-document').then(() => {
    return backend.listDocuments()
  }).then(list => {
    t.equal(list.length, 1)
    t.equal(list[0].id, 'my-document')
    t.equal(list[0].type, 'document')
    t.end()
  })
})

test('Update manifest', function (t) {
  let backend = _initBackend()
  backend.createDocument('content', 'my-document').then(() => {
    return backend.updateManifest('my-document', {})
  }).then(manifest => {
    t.equal(manifest, undefined)
    t.end()
  }).catch(error => {
    t.notOk(error)
    t.end()
  })
})

test('Saving / exporting a document', function (t) {
  let backend = _initBackend()
  backend.createDocument(helloWorld, 'hello-world').then(() => {
    return backend.getBuffer('hello-world')
  }).then((buffer) => {
    return buffer.writeFile('index.html', 'text/html', helloWorldModified)
  }).then((buffer) => {
    return backend.storeBuffer(buffer)
  }).then(() => {
    let updatedFile = fs.readFileSync(
      path.join(TMP_FOLDER, 'hello-world', 'storage', 'index.html'),
      'utf8'
    )
    t.equal(updatedFile, helloWorldModified)
    t.end()
  })
})

test('Discard a buffer and restore last saved version', function (t) {
  let backend = _initBackend()
  backend.createDocument(helloWorld, 'hello-world').then(() => {
    return backend.getBuffer('hello-world')
  }).then((buffer) => {
    return buffer.writeFile('index.html', 'text/html', helloWorldModified)
  }).then((buffer) => {
    return backend.discardBuffer(buffer, 'hello-world')
  }).then(() => {
    let updatedFile = fs.readFileSync(
      path.join(TMP_FOLDER, 'hello-world', 'index.html'),
      'utf8'
    )
    t.equal(updatedFile, helloWorld)
    t.end()
  })
})

test('Delete a document', function (t) {
  let backend = _initBackend()
  backend.createDocument(helloWorld, 'hello-world').then(documentId => {
    return backend.deleteDocument(documentId)
  }).then(() => {
    return backend.getBuffer('hello-world')
  }).then(buffer => {
    buffer.readFile('index.html', 'text/html').then(() => {
      t.fail("shouldn't get here")
      t.end()
    }).catch(error => {
      t.ok(error.message.match('no such file or directory'))
      t.end()
    })
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
