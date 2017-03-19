class HTMLConverter {

  /*
    Takes an archive (produced by storer) and a internalArchive, the one stored
    internally by Stencila.

    Original fileName is needed because otherwise we don't know what to read
    from the archive.

    TODO: The source archive could include binaries, which we should also
          consider.
  */
  importDocument(sourceArchive, internalArchive, folderPath, fileName) {
    let manifest = {
      "type": "document",
      "storage": {
        "storerType": "filesystem",
        "contentType": "html",
        "folderPath": folderPath,
        "fileName": fileName
      },
      "title": "No title available yet",
      "createdAt": "2017-03-10T00:03:12.060Z",
      "updatedAt": "2017-03-10T00:03:12.060Z"
    }

    return sourceArchive.readFile(
      fileName,
      'text/html'
    ).then((htmlFile) => {
      return internalArchive.writeFile(
        'index.html',
        'text/html',
        htmlFile
      )
    }).then(() => {
      return internalArchive.writeFile(
        'stencila-manifest.json',
        'application/json',
        JSON.stringify(manifest)
      )
    }).then(() => {
      return manifest
    })
  }

  /*
    Takes an internal archive and turns it back into the source layout
  */
  exportDocument(internalArchive, sourceArchive, folderPath, fileName) {
    return internalArchive.readFile('index.html', 'text/html').then((htmlFile) => {
      sourceArchive.writeFile(fileName, 'text/html', htmlFile)
    })
  }
}

HTMLConverter.match = function(filePath) {
  return filePath.indexOf('.html') >= 0
}

module.exports = HTMLConverter
