const request = require('request-promise')

/**
 * Proxy to a remote component
 */
class ComponentDelegate {

  constructor (url) {
    this.url = url
  }

  get (name) {
    return new Promise((resolve, reject) => {
      request({
        url: this.url + '!' + name,
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
        url: this.url + '!' + name,
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
        url: this.url + '!' + name,
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

}

module.exports = ComponentDelegate
