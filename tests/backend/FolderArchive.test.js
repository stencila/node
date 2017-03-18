const rimraf = require('rimraf')
const fs = require('fs')
const path = require('path')
const test = require('tape')
const FolderArchive = require('../../src/backend/FolderArchive')

let TMP_FOLDER = path.join(__dirname, 'tmp-folder')

test('write+read: Write a text file and then read it', function (t) {
  let archive = _createEmptyFolderArchive()
  archive.writeFile('index.html', 'text/html', 'HELLO WORLD').then(() => {
    archive.readFile('index.html', 'text/html').then((fileData) => {
      t.equal(fileData, 'HELLO WORLD')
    })
  })
})

function _createEmptyFolderArchive() {
  // Clean up
  rimraf.sync(TMP_FOLDER)
  fs.mkdirSync(TMP_FOLDER)
  // Setup
  return new FolderArchive(TMP_FOLDER)
}
