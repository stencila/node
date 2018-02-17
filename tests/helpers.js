const test = require('tape')

var testPromise = (name, f) => {
  test(name, t => {
    f(t).catch(e => {
      t.fail(e.message)
      console.log(e.stack) // eslint-disable-line
      t.end()
    })
  })
}

module.exports = testPromise
