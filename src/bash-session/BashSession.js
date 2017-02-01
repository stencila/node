const spawn = require('child_process').spawn
const pack = require('stencila-js').pack

const Session = require('../session/Session')

/**
 * A Bash session
 *
 * [Bash](https://en.wikipedia.org/wiki/Bash_(Unix_shell)) is a commonly used Unix shell language.
 *
 * See issue https://github.com/stencila/node/issues/4 for
 * several things that need to be improved with this.
 */
class BashSession extends Session {

  constructor () {
    super()
    this._bash = spawn('bash')
  }

  static get type () {
    return 'bash-session'
  }

  execute (code) {
    return new Promise((resolve, reject) => {
      let bash = this._bash

      bash.stdout.on('data', data => {
        resolve({
          errors: {},
          output: pack(data.toString('utf8'))
        })
      })

      bash.stderr.on('data', data => {
        resolve({
          errors: {
            '0': data.toString('utf8')
          },
          output: null
        })
      })

      bash.on('error', error => {
        resolve({
          errors: {
            '0': error
          },
          output: null
        })
      })

      bash.stdin.write(code + '\n')
    })
  }

}

module.exports = BashSession
