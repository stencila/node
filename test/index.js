const glob = require('glob')
const path = require('path')
const test = require('tape')

// Exit the process when all tests have finished running
// (otherwise server can keep on servin`)
test.onFinish(function () {
  process.exit()
})

// Require in all the test files
glob.sync(path.join(__dirname, '/**/*.test.js')).forEach(function (pathname) {
  require(pathname)
})
