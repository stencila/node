const fs = require('fs')

class ComponentConverter {

  load (component, content, format, options) {
    throw Error('This method must be implmented in derived class')
  }

  dump (component, format, options) {
    throw Error('This method must be implmented in derived class')
  }

  read (component, path, format, options) {
    this.load(component, fs.readFileSync(path), format, options)
  }

  write (component, path, format, options) {
    fs.writeFileSync(path, this.dump(component, format, options))
  }

}

module.exports = ComponentConverter
