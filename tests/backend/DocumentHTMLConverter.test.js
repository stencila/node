const test = require('tape')
const { MemoryArchive } = require('stencila')
const DocumentHTMLConverter = require('../../src/backend/DocumentHTMLConverter')

test('Convert into internal archive from an HTML file', function (t) {
  let converter = new DocumentHTMLConverter()
  let storer = _createFileStorer()
  let archive = new MemoryArchive()

  converter.importDocument(
    storer,
    archive,
    '/path/to/folder',
    'hello.html'
  ).then((manifest) => {
    archive.readFile('index.html', 'text/html').then((html) => {
      t.equal(html, 'HELLO WORLD')
      t.equal(manifest.storage.folderPath, '/path/to/folder')
      t.equal(manifest.type, 'document')
      t.end()
    })
  })
})

test('Convert to named HTML file from internal archive', function (t) {
  let converter = new DocumentHTMLConverter()
  let archive = _createArchive()
  let storer = new MemoryArchive()
  converter.exportDocument(
    archive,
    storer,
    '/path/to/folder',
    'hello.html'
  ).then(() => {
    storer.readFile('hello.html', 'text/html').then((html) => {
      t.equal(html, 'HELLO WORLD')
      t.end()
    })
  })
})

test('Should match an HTML file path', function (t) {
  let matched = DocumentHTMLConverter.match('/foo/bar.html')
  t.ok(matched)
  t.end()
})

/*
  NOTE: We know that MemoryArchive is implemented synchronously, so we don't
        wait for the promise.
*/
function _createFileStorer() {
  let storer = new MemoryArchive()
  storer.writeFile('hello.html', 'text/html', 'HELLO WORLD')
  return storer
}

function _createArchive() {
  let archive = new MemoryArchive()
  archive.writeFile('index.html', 'text/html', 'HELLO WORLD')
  archive.writeFile('stencila-manifest.json', 'application/json', JSON.stringify({
    "type": "document",
    "storage": {
      "storerType": "filesystem",
      "contentType": "html",
      "folderPath": '/path/to/folder',
      "fileName": 'hello.html'
    },
    "title": "Hello",
    "createdAt": "2017-03-10T00:03:12.060Z",
    "updatedAt": "2017-03-10T00:03:12.060Z"
  }))
  return archive
}
