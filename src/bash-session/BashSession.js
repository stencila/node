const Session = require('../session/Session')

const spawn = require('child_process').spawn

class BashSession extends Session {

  constructor () {
    super()
    this._bash = spawn('bash')
  }

  static get type () {
    return 'bash-session'
  }

  execute (code) {
    let result = {
      errors: null,
      output: null,
      pipes: null
    }
    return new Promise((resolve, reject) => {
      this._bash.stdout.on('data', data => {
        result.output = {
          format: 'text',
          content: data.toString('utf8')
        }
        resolve(result)
      })
      this._bash.stdin.write(code + '\n')
    })
  }

}

module.exports = BashSession
