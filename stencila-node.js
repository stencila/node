#!/usr/bin/env node

const stencila = require('.')
const colors = require('colors') // eslint-disable-line no-unused-vars

// Banner
console.log(('Stencila CLI for Node.js ' + stencila.version + '\n').green)

// Start up the host and notify user
stencila.host.startup().then(function () {
  console.log(stencila.host.title + ' is being served at ' + stencila.host.url)
})
