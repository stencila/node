// Various shortcut functions and variables providing a similar interface
// to the package as for other Stencila language packages
// e.g. https://github.com/stencila/r/blob/master/R/main.R

const pkg = require('../package')
const Host = require('./host/Host')
const host = new Host()

const version = pkg.version

module.exports = {
  version: version,
  host: host,
  register: host.register.bind(host),
  start: host.start.bind(host),
  stop: host.stop.bind(host),
  run: host.run.bind(host),
  spawn: host.spawn.bind(host)
}
