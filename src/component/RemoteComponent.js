const request = require('request-promise')

class RemoteComponent {

  constructor (host, id) {
    this._host = host
    this._address = id
  }

  get (name) {
    return new Promise((resolve, reject) => {
      request({
        uri: this._host + '/' + this._address + '!' + name,
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
        uri: this._host + '/' + this._address + '!' + name,
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

  call (name, value) {
    return new Promise((resolve, reject) => {
      request({
        uri: this._host + '/' + this._address + '!' + name,
        method: 'POST',
        body: Array.prototype.slice.call(arguments, 1),
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

}

module.exports = RemoteComponent
