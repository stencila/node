const {JsContext} = require('stencila')

/**
 * A Node.js context for executing Javascript code
 */
class NodeContext extends JsContext {}

NodeContext.spec = {
  name: 'NodeContext',
  base: 'Context',
  aliases: ['node']
}

module.exports = NodeContext
