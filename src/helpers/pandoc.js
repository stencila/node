/**
 * A simple wrapper around Pandoc
 *
 * At the time of writing there were at least three Node modules which
 * wrapped Pandoc in a similar way.
 *
 * - https://github.com/eshinn/node-pandoc
 * - https://github.com/pvorb/node-pdc
 * - https://github.com/sbisbee/node-pandoc
 *
 * However, all of these are asynchronous. Insteead, this module implements synchronous conversion via
 * Pandoc.
 *
 * The main function is `convert` and `read` and `write` provide
 * some optimisation for reading and writing directly from/to disk.
 *
 * @module helpers/pandoc
 */

const spawn = require('child_process').spawnSync

function call (args, options) {
  options = options || {
    encoding: 'utf8'
  }
  let result = spawn('pandoc', args, options)
  if (result.status !== 0) {
    let message = 'Error in pandoc call'
    if (result.stderr) message += result.stderr
    throw new Error(message)
  }
  return result.stdout
}

function enabled () {
  try {
    call(['--version'])
    return true
  } catch (error) {
    return false
  }
}

/**
 * Convert some content from one format to another
 *
 * @memberof helpers/pandoc
 * @static
 *
 * @param  {String} content Content to convert
 * @param  {String} from    Current format of the content
 * @param  {String} to      Desired format for the content
 * @param  {Object} options An object of additional Pandoc options. Use a `null` value ie. `{ option : null }` for options that are simple
 *                          flags (ie don't have a value) e.g. 'no-highlight'
 * @return {String}         The converted content
 */
function convert (content, from, to, options) {
  let args = []
  if (from) args.push('--from', from)
  if (to) args.push('--to', to)
  for (let option in options) {
    args.push(`--${option}`)
    if (options[option] !== null) args.push(options[option].toString())
  }
  return call(args, {
    input: content,
    encoding: 'utf8'
  })
}

function read (path, from, to) {
  return call(['--from', from, '--to', to, path])
}

function write (content, from, to, path) {
  call(['--from', from, '--to', to, '--output', path], {
    input: content,
    encoding: 'utf8'
  })
}

module.exports = {
  call: call,
  enabled: enabled,
  convert: convert,
  read: read,
  write: write
}
