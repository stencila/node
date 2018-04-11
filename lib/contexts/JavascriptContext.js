const acorn = require('acorn')
const doctrine = require('doctrine')
const walk = require('acorn/dist/walk')

const Context = require('./Context')

/**
 * A Node.js context for executing  code
 */
class JavascriptContext extends Context {
  compile (node) {
    if (node.type === 'func') {
      return this.compileFunc(node)
    }
  }

  compileFunc (func) {
    if (typeof func === 'string' || func instanceof String) {
      func = {
        source: {
          type: 'text',
          lang: 'js',
          data: func
        }
      }
    }
    if (!func.type) func.type = 'func'

    let code = func.source.data

    // Parse the source code collecting any comments
    let ast
    let docs
    try {
      ast = acorn.parse(code, {
        onComment: (block, text) => {
          if (block && !docs) docs = text
        }
      })
    } catch (error) {
      throw new Error('Syntax error in source code: ' + error.message)
    }

    // Extract the first `FunctionDeclaration` from the AST.
    let decl
    walk.simple(ast, {
      FunctionDeclaration (node) {
        if (!decl) decl = node
      }
    })
    if (!decl) throw new Error('No function definition found in the source code')

    // Get function name
    const name = decl.id.name

    // Process each parameter declaration node into a parameter spec
    let params = []
    for (let node of decl.params) {
      let param = {}
      switch (node.type) {
        case 'Identifier':
          if (node.name.substring(0, 3) === '___') {
            param.name = node.name.substring(3)
            param.extends = true
          } else {
            param.name = node.name
          }
          break
        case 'RestElement':
          param.name = node.argument.name
          param.repeats = true
          break
        case 'AssignmentPattern':
          param.name = node.left.name
          param.default = code.substring(node.right.start, node.right.end)
          break
        default:
          throw new Error(`Unhandled parameter node type "${node.type}"`)
      }
      params.push(param)
    }

    let examples = []
    if (docs) {
      // Strip spaces and asterisks from front of each line
      docs = docs.replace(/^\s*\*?/mg, '')
      // Parse JSDoc documentation
      const tags = doctrine.parse(docs, {
        sloppy: true // allow optional parameters to be specified in brackets
      }).tags
      // Process tags
      for (let tag of tags) {
        switch (tag.title) {
          case 'name':
            if (tag.name !== name) throw new Error(`Documentation tag @name with name "${tag.name}" differs from name in function definition`)
            break

          case 'title':
            func.title = tag.description
            break

          case 'summary':
            func.summary = tag.description
            break

          case 'example':
            examples.push(tag.description)
            break

          case 'param':
            // Get the parameter object extracted from the function definition
            let which = null
            for (let [index, param] of Object.entries(params)) {
              if (param.name === tag.name) {
                which = index
                break
              }
            }
            if (which === null) throw new Error(`Documentation tag @param for parameter "${tag.name}" which is not in function definition`)
            let param = params[which]

            if (tag.type) {
              let type
              switch (tag.type.type) {
                case 'AllLiteral':
                  type = 'any'
                  break
                case 'NameExpression':
                  type = tag.type.name
                  break
                case 'TypeApplication':
                  type = tag.type.expression.name + '[' +
                         tag.type.applications.map((application) => application.name).join(',') + ']'
                  break
                case 'OptionalType':
                  type = tag.type.expression.name
                  type = tag.default ? type : 'null'
                  break
                default:
                  throw new Error('Unhandled @param type specification: ' + tag.type.type)
              }
              param.type = type
            }
            if (tag.description) param.description = tag.description
            break

          case 'return':
            func.return = {}
            if (tag.type) {
              let type
              switch (tag.type.type) {
                case 'NameExpression':
                  type = tag.type.name
                  break
                default:
                  throw new Error('Unhandled @return type specification: ' + tag.type.type)
              }
              func.return.type = type
            }
            if (tag.description) func.return.description = tag.description
            break
        }
      }
    }

    func.name = name
    if (params.length) func.params = params
    if (examples.length) func.examples = examples

    return func
  }
}

JavascriptContext.spec = {
  name: 'JavascriptContext',
  client: 'ContextHttpClient'
}

module.exports = JavascriptContext
