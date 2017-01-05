/*
 * Primary entry point for this package. Only exports
 * classes and objects that will normally be used by external
 * packages. Base classes (e.g. `Component`) and internal classes
 * (e.g. `Host`) are not exported
 */

const Document = require('./src/document/Document')
const Sheet = require('./src/sheet/Sheet')
const JavascriptSession = require('./src/js-session/JavascriptSession')
const host = require('./src/host/host')
const version = require('./package').version

module.exports = {
  Document: Document,
  Sheet: Sheet,
  JavascriptSession: JavascriptSession,
  host: host,
  version: version
}
