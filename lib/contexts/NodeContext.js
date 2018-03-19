const Context = require('./Context')

/**
 * A Node.js context for executing Javascript code
 */
class NodeContext extends Context {}

NodeContext.spec = {
  name: 'NodeContext',
  client: 'ContextHttpClient'
}

module.exports = NodeContext
