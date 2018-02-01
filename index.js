// Various shortuct functions and variables providing a similar interface
// to the package as in other Stencila language packages 
// e.g. https://github.com/stencila/r/blob/master/R/main.R

const version = require('./package').version

const Host = require('./src/host/Host')
const host = new Host()

module.exports = {
  version: version,
  
  host: host,
  install: host.install,
  start: host.start,
  stop: host.stop,
  run: host.run
}
