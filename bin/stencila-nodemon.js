#!/usr/bin/env node

// For running the host during development e.g. using `npm start`
// Handles `nodemon` restart signal SIGUSR2 to ensure that the
// host is gracefully shutdown. In particular, this prevents large
// numbers of temporary host manifest files being left in `tmp/stencila/hosts`

const stencila = require('../lib/index.js')
stencila.run()
process.once('SIGUSR2', stencila.stop)
