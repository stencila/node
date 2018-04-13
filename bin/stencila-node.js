#!/usr/bin/env node

/**
 * A command line interface, primarily intended for machine use,
 * such as spawning new hosts. Provide a function name as first argument
 * and function options as a JSON object in the second argument or
 * standard input. e.g.
 *
 *   stencila-node spawn '{"port":2300}'
 *   echo '{"port":2300}' | stencila-node spawn
 */

const getStdin = require('get-stdin')
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
  let inp = process.argv[3] || await getStdin()
  let options
  if (inp && inp.length) {
    try {
      options = JSON.parse(inp)
    } catch (error) {
      // Treat options as a string argument
      options = inp
    }
  }

  // Execute the function and output any result as JSON
  const result = await func(options)
  if (result) {
    const out = JSON.stringify(result)
    console.log(out)
  }
})()
