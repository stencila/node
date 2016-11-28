const ComponentDataConverter = require('../component/ComponentDataConverter')

class DocumentDataConverter extends ComponentDataConverter {

  dump (document, format, options) {
    let data = super.dump(document)
    data.content = document.dump('html')
    data.sessions = document.sessions
    return data
  }

}

module.exports = DocumentDataConverter
