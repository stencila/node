var fs = require('fs')

const Component = require('../component/Component')

class Folder extends Component {

  constructor (path) {
    if (!fs.existsSync(path)) throw new Error(`Path does not exist: ${path}`)
    super(path, path)
  }

  list () {
    return new Promise((resolve, reject) => {
      fs.readdir(this.path, (error, files) => {
        if (error) reject(error)
        resolve(files)
      })
    })
  }

}

module.exports = Folder
