const JavascriptContext = require('./JavascriptContext')

/**
 * A Node.js context for executing Javascript code
 */
class NodeContext extends JavascriptContext {
  executeBlock (block) {
    block.output.value = this.pack('Hello from Node.js. This is just a test!')
    return block
  }
}

NodeContext.spec = {
  name: 'NodeContext',
  client: 'ContextHttpClient'
}

module.exports = NodeContext
