const Component = require('./src/component/Component')
const Host = require('./src/host/Host')
const Document = require('./src/document/Document')
const Sheet = require('./src/sheet/Sheet')
const Session = require('./src/session/Session')

const host = new Host()
host.serve()
host.discover()

module.exports = {
  Component: Component,
  Host: Host,
  Document: Document,
  Sheet: Sheet,
  Session: Session,

  host: host
}
