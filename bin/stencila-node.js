#!/usr/bin/env node

/**
 * A very simple command line interface, primarily intended for machine use,
 * such as spawning new hosts. Provide a function name as first argument
 * and function options as a JSON object in the second argument e.g.
 *
 *   stencila-node run
 *   stencila-node spawn '{"port":2300}'
 */

const stencila = require('../lib/index.js')

;(async function () {
  // Function to execute
  const name = process.argv[2] || 'run'
  const func = stencila[name]
  if (!func) {
    console.error('Not a valid function: ' + name)
    process.exit()
  }

  // Function options as JSON object from second argument or stdin
  let inp = process.argv[3]
  let options
  if (inp && inp.length) {
    if (inp[0] === '{') {
      try {
        options = JSON.parse(inp)
      } catch (error) {
        console.error('Could not parse JSON options supplied: ' + error.message)
        process.exit(1)
      }
    } else {
      // Treat options as a string argument
      options = inp
    }
  }

  // Execute the function and output any result as JSON
  let result
  try {
    result = await func(options)
  } catch (error) {
    console.error(error.stack)
  }
  if (result) {
    const out = JSON.stringify(result)
    console.log(out)
  }
})()
