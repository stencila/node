// Various shortuct functions and variables providing a similar interface
// to the package as in other Stencila language packages 
// e.g. https://github.com/stencila/r/blob/master/R/main.R

const version = require('./package').version

const Host = require('./src/host/Host')
const host = new Host()

module.exports = {
  version: version,
  
  host: host,
  register: host.register.bind(host),
  start: host.start.bind(host),
  stop: host.stop.bind(host),
  run: host.run.bind(host)
}
