const ComponentDataConverter = require('../component/ComponentDataConverter')

class FolderDataConverter extends ComponentDataConverter {

  dump (folder, format, options) {
    let data = super.dump(folder)
    return data
  }

}

module.exports = FolderDataConverter
