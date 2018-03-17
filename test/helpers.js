const test = require('tape')

/**
 * Test a promise
 *
 * A convienience function that provides for consistent
 * handling of errors when testing Promise based functions/class methods
 *
 * @param  {String} name Name of test
 * @param  {Function} func Test function returning a promise
 */
var testPromise = (name, func) => {
  test(name, assert => {
    func(assert).catch(error => {
      assert.fail(error.message)
      console.log(error.stack) // eslint-disable-line
      assert.end()
    })
  })
}

module.exports = {
  testPromise
}
