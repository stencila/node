const request = require('request-promise')

function request_ (method, url, data) {
  return request({
    method: method,
    uri: url,
    headers: {
      Accept: 'application/json'
    },
    body: data,
    json: true
  })
}

function GET (url) {
  return request_('GET', url)
}

function POST (url, data) {
  return request_('POST', url, data)
}

function PUT (url, data) {
  return request_('PUT', url, data)
}

module.exports = { GET, POST, PUT }
