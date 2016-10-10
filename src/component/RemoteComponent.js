const request = require('request-promise')

class RemoteComponent {

  /**
   * Construct a remote component
   *
   * @param  {string} url URL of the component
   */
  constructor (url) {
    this._url = url
  }

  get (name) {
    return new Promise((resolve, reject) => {
      request({
        url: this._url + '!' + name,
        method: 'GET',
        json: true
      })
      .then(function (data) {
        resolve(data)
      })
      .catch(function (error) {
        reject(error)
      })
    })
  }

  set (name, value) {
    return new Promise((resolve, reject) => {
      request({
        url: this._url + '!' + name,
        method: 'PUT',
        body: value,
        json: true
      })
      .then(function () {
        resolve()
      })
      .catch(function (error) {
        reject(error)
      })
    })
  }

  call (name) {
    let args = Array.prototype.slice.call(arguments, 1)
    return new Promise((resolve, reject) => {
      request({
        url: this._url + '!' + name,
        method: 'POST',
        body: args,
        json: true
      })
      .then(function (data) {
        resolve(data)
      })
      .catch(function (error) {
        reject(error)
      })
    })
  }

  read (path) {
    return this.call('read', path || null)
  }

  write (path) {
    return this.call('write', path || null)
  }

  save (content, format, path) {
    return this.call('save', content, format, path || null)
  }

}

module.exports = RemoteComponent
