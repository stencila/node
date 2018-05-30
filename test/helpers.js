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
    } catch (error) {
      assert.fail(error.stack)
      assert.end()
    }
  })
}

module.exports = {
  test,
  testAsync
}
