const request = require('request-promise')

class ComponentProxy {

  /**
   * Construct a remote component
   *
   * @param  {string} url URL of the component
   * @param  {string} type The type of the component
   */
  constructor (type, url) {
    this._type = type
    this._url = url
  }

  get type () {
    return this._type
  }

  get url () {
    return this._url
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
        console.error('Error in remote get: ' + error.error)
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
        console.error('Error in remote set: ' + error.error)
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
        console.error('Error in remote call: ' + error.error)
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

  show (format) {
    format = format || 'json'
    if (format === 'json') {
      return JSON.stringify({
        type: this._type,
        url: this._url
      })
    } else {
      return this.call('show', format)
    }
  }

}

module.exports = ComponentProxy
