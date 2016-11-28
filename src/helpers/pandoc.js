/**
 * @module helpers/pandoc
 *
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

function convert (content, from, to, options) {
  let args = ['--from', from, '--to', to]
  for (let option in options) {
    args.push(`--${option}`)
    args.push(options[option].toString())
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
