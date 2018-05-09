const test = require('tape')

/**
 * Test an async function
 *
 * A convienience function that provides for consistent
 * handling of errors when testing async funcions
 *
 * @param  {String} name Name of test
 * @param  {Function} func Async test function
 */
var testAsync = (name, func) => {
  test(name, async assert => {
    try {
      await func(assert)
    } catch(error) {
      assert.fail(error.message)
      console.log(error.stack) // eslint-disable-line
      assert.end()
    }
  })
}

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
  testAsync,
  testPromise
}
