#!/usr/bin/env node

const stencila = require('.')

// Banner
console.log(('Stencila CLI for Node.js ' + stencila.version + '\n')) // eslint-disable-line no-console

// Start up the host and notify user
stencila.host.start().then(function () {
  console.log('Host is served at: ' + stencila.host.urls.join(', ')) // eslint-disable-line no-console
})
