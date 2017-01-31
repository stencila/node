const Component = require('../component/Component')

class Session extends Component {

  get type () {
    return this._delegate ? this.delegate.get('type') : this.constructor.type
  }

  static get kind () {
    return 'session'
  }

  execute (code, inputs) {
    return this.delegate.call('execute', code, inputs)
  }

}

module.exports = Session
