class Context {
  pack (value) {
    const type = value.type || typeof value
    switch (type) {
      default: return {type, data: value}
    }
  }

  compile (node) {

  }

  execute (node) {
    const type = node.type
    switch (type) {
      case 'eval':
        return this.executeEval(node)
      case 'run':
        return this.executeRun(node)
      default:
        throw new Error('Unknown node type')
    }
  }

  // Legacy API methods

  analyseCode (code, exprOnly = false) {
    return Promise.resolve({
      inputs: [],
      outputs: [],
      messages: []
    })
  }

  executeCode (code = '', inputs = {}, exprOnly = false) {
    const source = {
      type: 'text',
      data: code
    }
    if (exprOnly) {
      return this.executeEval({
        source: source
      })
    } else {
      return this.executeRun({
        source: source
      })
    }
  }
}

module.exports = Context
