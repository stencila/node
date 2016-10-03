class ComponentConverter {

  load (component, content, format, options) {
    throw Error('This method must be implmented in derived class')
  }

  dump (component, format, options) {
    throw Error('This method must be implmented in derived class')
  }

  read (component, path, format, options) {
    throw Error('This method must be implmented in derived class')
  }

  write (component, path, format, options) {
    throw Error('This method must be implmented in derived class')
  }

}

module.exports = ComponentConverter
