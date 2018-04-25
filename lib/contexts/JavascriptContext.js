const acorn = require('acorn')
const doctrine = require('doctrine')
const walk = require('acorn/dist/walk')

const Context = require('./Context')

/**
 * A Node.js context for executing  code
 */
class JavascriptContext extends Context {
  constructor (host, name) {
    super(host, name)

    /**
     * Libraries registered in this context
     *
     * @type {Object}
     */
    this._libraries = {}
  }

  async libraries () {
    return this._libraries
  }

  async compileFunc (func) {
    if (typeof func === 'string' || func instanceof String) {
      func = {
        source: {
          type: 'text',
          lang: 'js',
          data: func
        }
      }
    } else if (typeof func === 'function') {
      func = {
        source: {
          type: 'text',
          lang: 'js',
          data: func.toString()
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
        sourceType: 'module',
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

    // Extract the type specification for a `@param` or `@return` tag
    function _extractType (tag) {
      switch (tag.type.type) {
        case 'AllLiteral':
          return 'any'
        case 'NameExpression':
          return tag.type.name
        case 'UnionType':
          return tag.type.elements.map((element) => element.name).join('|')
        case 'TypeApplication':
          return tag.type.expression.name + '[' +
                 tag.type.applications.map((application) => application.name).join(',') + ']'
        case 'OptionalType':
          return tag.default ? tag.type.expression.name : 'null'
        case 'RestType':
          return tag.type.expression.name
        default:
          throw new Error('Unhandled type specification: ' + tag.type.type)
      }
    }

    let examples = []
    if (docs) {
      // Strip spaces and asterisks from front of each line
      docs = docs.replace(/^\s*\*?/mg, '')
      // Parse JSDoc documentation
      const {description, tags} = doctrine.parse(docs, {
        sloppy: true // allow optional parameters to be specified in brackets
      })
      func.description = description
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
            let example = {usage: tag.description}
            if (tag.caption) example.caption = tag.caption
            examples.push(example)
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

            if (tag.type) param.type = _extractType(tag)
            if (tag.description) param.description = tag.description
            break

          case 'return':
            func.return = {}
            if (tag.type) func.return.type = _extractType(tag)
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

  async executeFunc (func) {
    func = await this.compileFunc(func)

    let code = func.source.data
    func._func = eval(code + ';' + func.name) // eslint-disable-line no-eval

    if (!this._libraries['local']) this._libraries['local'] = {}
    this._libraries['local'][func.name] = func
    return func
  }

  async executeGet (get) {
    // Currently, this just iterates over registered libraries looking
    // for a value with the name
    let value
    for (let library of Object.values(this._libraries)) {
      value = library[get.name]
      if (value) break
    }
    if (!value) throw new Error(`Could not get value "${get.name}"`)
    return value
  }

  async executeCell (cell) {
    const code = cell.source.data
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const func = new AsyncFunction('_', 'return ' + code) // eslint-disable-line no-new-func
    const value = await func(this)
    cell.output.value = this.pack(value)
    return cell
  }

  async executeCall (call) {
    // Get the function
    const func = await this.execute(call.func)

    // Using `func.params` specification, map the call's arguments onto the function's parameters
    let args = []
    let argsIndex = 0
    let argsUsed = 0
    let namedArgs
    let namedArgsUsed = []
    if (func.params) {
      for (let param of func.params) {
        if (param.repeats) {
          // Put the remaining arguments into an array
          let remaining = []
          for (; argsIndex < call.args.length; argsIndex++) {
            remaining.push(await this.execute(call.args[argsIndex]))
            argsUsed++
          }
          args.push(remaining)
          break
        } else if (param.extends) {
          // Put the remaining named arguments into an object
          if (call.namedArgs) {
            namedArgs = {}
            for (let name of Object.keys(call.namedArgs)) {
              if (namedArgsUsed.indexOf(name) < 0) {
                namedArgs[name] = await this.execute(call.namedArgs[name])
                namedArgsUsed.push(param.name)
              }
            }
          }
          break
        } else {
          // Get the argument for the parameter either by name or by index
          let arg
          if (call.namedArgs) {
            arg = call.namedArgs[param.name]
            if (arg) namedArgsUsed.push(param.name)
          }
          if (!arg && call.args) {
            arg = call.args[argsIndex]
            if (arg) argsUsed++
          }
          if (!arg && !param.default) {
            throw new Error(`Function parameter "${param.name}" must be supplied`)
          }
          if (arg) args.push(await this.execute(arg))
          else args.push(undefined)
        }
        argsIndex++
      }
    }
    // Check that there are no extra, unused arguments in call
    if (call.args && argsUsed < call.args.length) {
      const extra = call.args.length - argsUsed
      throw new Error(`Function was supplied ${extra} extra arguments`)
    }
    if (call.namedArgs && namedArgsUsed.length < Object.keys(call.namedArgs).length) {
      const extra = Object.keys(call.namedArgs).filter((arg) => namedArgsUsed.indexOf(arg) < 0)
        .map((arg) => `"${arg}"`)
        .join(', ')
      throw new Error(`Function was supplied extra named arguments ${extra}`)
    }
    // Execute the actual function call
    let value = namedArgs ? func._func(...args, namedArgs) : func._func(...args)
    if (value !== undefined) call.value = await this.pack(value)

    return call
  }
}

JavascriptContext.spec = {
  name: 'JavascriptContext',
  client: 'ContextHttpClient'
}

module.exports = JavascriptContext
