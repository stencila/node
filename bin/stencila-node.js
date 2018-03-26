#!/usr/bin/env node

const stencila = require('../lib/index.js')

stencila[process.argv[2] || 'run']()
