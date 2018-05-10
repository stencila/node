const acorn = require('acorn')
const doctrine = require('doctrine')
const { generate } = require('astring')
const walk = require('acorn/dist/walk')

const Context = require('./Context')

/**
 * Global variable names that should be ignored when determining
 * cell inputs with the `compile()` method
 *
 * @type {Array}
 */
const GLOBALS = [
  // A list of ES6 globals obtained using: Object.keys(require('globals').es6)
  'Array', 'ArrayBuffer', 'Boolean', 'constructor', 'DataView', 'Date', 'decodeURI', 'decodeURIComponent',
  'encodeURI', 'encodeURIComponent', 'Error', 'escape', 'eval', 'EvalError', 'Float32Array', 'Float64Array',
  'Function', 'hasOwnProperty', 'Infinity', 'Int16Array', 'Int32Array', 'Int8Array', 'isFinite', 'isNaN',
  'isPrototypeOf', 'JSON', 'Map', 'Math', 'NaN', 'Number', 'Object', 'parseFloat', 'parseInt', 'Promise',
  'propertyIsEnumerable', 'Proxy', 'RangeError', 'ReferenceError', 'Reflect', 'RegExp', 'Set', 'String',
  'Symbol', 'SyntaxError', 'System', 'toLocaleString', 'toString', 'TypeError', 'Uint16Array', 'Uint32Array',
  'Uint8Array', 'Uint8ClampedArray', 'undefined', 'unescape', 'URIError', 'valueOf', 'WeakMap', 'WeakSet',
  // A list of Node.js globals obtained using: Object.keys(require('globals').node)
  '__dirname', '__filename', 'arguments', 'Buffer', 'clearImmediate', 'clearInterval', 'clearTimeout', 'console',
  'exports', 'GLOBAL', 'global', 'Intl', 'module', 'process', 'require', 'root', 'setImmediate', 'setInterval', 'setTimeout'
]

/**
 * An execution context for Javascript
 *
 * Although this currently resides in the `stencila/node` repository,
 * it is intended for eventual use within the browser by
 * replacing the `JsContext in `stencila/stencila`
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

    /**
     * Variables residing in this context
     *
     * @type {Object}
     */
    this._variables = {}
  }

  /**
   * Pack a value
   *
   * An overide of `Context.pack` which deals
   * with packing of functions.
   *
   * @overide
   */
  async pack (value) {
    if (typeof value === 'function') {
      return {
        type: 'function',
        data: value._spec || {name: value.name},
        location: this.location
      }
    } else {
      return super.pack(value)
    }
  }

  /**
   * Get the libraries registered in this context
   */
  async libraries () {
    return this._libraries
  }

  /**
   * Get the variables residing in this context
   */
  async variables () {
    let packed = {}
    for (let [name, variable] of Object.entries(this._variables)) {
      packed[name] = await this.pack(variable)
    }
    return packed
  }

  /**
   * Compile a cell
   */
  async compile (cell, internal = false) {
    // Cell source code
    let source
    if (typeof cell === 'string' || cell instanceof String) {
      source = cell
    } else if (typeof cell === 'function') {
      source = cell.toString()
    } else {
      source = cell.source.data
    }

    // Should source be a simple expression?
    const exprOnly = cell.expr || false

    // Input values
    let inputs = []

    // Output name and value (currently assuming a single output)
    let name
    let value

    // A code expression to execute to get the return value
    // (only used internally as an optimisation when
    // called by `this.execute()`)
    let _return = null

    // Error messages
    let messages = []

    // Parse the source code (including comments for function definitions)
    let ast
    let docs = []
    try {
      ast = acorn.parse(source, {
        sourceType: 'module',
        onComment: (block, text) => {
          if (block) docs.push(text)
        }
      })
    } catch (error) {
      let line = 0
      let column = 0
      if (error instanceof SyntaxError && error.loc) {
        line = error.loc.line
        column = error.loc.column
      }
      messages.push({
        type: 'error',
        message: 'Syntax error in Javascript: ' + error.message,
        line,
        column
      })
    }
    if (docs.length === 0) docs.push(null)

    // Check for single expression only
    // Only allow simple expressions
    // See http://esprima.readthedocs.io/en/latest/syntax-tree-format.html#expressions-and-patterns
    // for a list of expression types
    if (messages.length === 0 && exprOnly) {
      try {
        if (ast.body.length > 1) throw new Error()
        const first = ast.body[0]
        if (!first) throw new Error()
        if (first.type !== 'ExpressionStatement') throw new Error()
        const dissallowed = ['AssignmentExpression', 'UpdateExpression', 'AwaitExpression', 'Super']
        if (dissallowed.indexOf(first.expression.type) >= 0) throw new Error()
      } catch (error) {
        messages.push({
          type: 'error',
          message: 'Cell source code must be a single, simple Javascript expression'
        })
      }
    }

    if (messages.length === 0) {
      // Determine which names are declared and which are used
      // do not enter some nodes like blocks and function declarations
      // because we only want to pick up top level declarations and
      // identifers
      let declared = []
      walk.recursive(ast, {}, {
        BlockStatement (node, state, contin) {},
        // For statements contain variable declarations we wish to ignore
        ForStatement (node, state, contin) {},
        ForInStatement (node, state, contin) {},
        ForOfStatement (node, state, contin) {},
        FunctionDeclaration (node, state, contin) {
          declared.push(node.id.name)
        },
        VariableDeclarator (node, state, contin) {
          declared.push(node.id.name)
          // Recurse into initializer
          if (node.init) contin(node.init, state)
        },
        Identifier (node, state, contin) {
          let name = node.name
          if (declared.indexOf(name) < 0 && GLOBALS.indexOf(name) < 0) {
            inputs.push({ name })
          }
        }
      })

      // If the last top level node in the AST is a FunctionDeclaration,
      // VariableDeclaration or Identifier then use it's name as the output name
      let last = ast.body.pop()
      if (last) {
        switch (last.type) {
          case 'FunctionDeclaration':
            name = last.id.name
            value = this._compileFunction(name, last, source, docs)
            _return = name
            break
          case 'ExportDefaultDeclaration':
            // Currently, only handle exported functions
            const decl = last.declaration
            if (decl.type === 'FunctionDeclaration') {
              name = decl.id.name
              value = this._compileFunction(name, decl, source, docs)
              _return = name
            }
            break
          case 'VariableDeclaration':
            name = last.declarations[0].id.name
            _return = name
            break
          case 'ExpressionStatement':
            if (last.expression.type === 'Identifier') {
              // If the identifier is not in inputs then
              // use it as the output name
              const id = last.expression.name
              if (inputs.filter(({name}) => name === id).length === 0) {
                name = id
              }
            }
            _return = generate(last)
            break
          case 'BlockStatement':
          case 'IfStatement':
            break
          default:
            // During development it can be useful to turn this on
            throw new Error('Unhandled AST node type: ' + last.type)
        }
      }
    }

    let output = {}
    if (name) output.name = name
    if (value) output.value = await this.pack(value)
    let outputs = (name || value || _return) ? [output] : []

    const compiled = {
      type: 'cell',
      source: {
        type: 'string',
        data: source
      },
      inputs,
      outputs,
      messages
    }
    if (internal) compiled._return = _return

    return compiled
  }

  _compileFunction (name, decl, source, docs) {
    let func = {
      type: 'function',
      name: name
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

    let methods = {}
    for (let doc of docs) {
      let method = {}
      let params = []
      let return_
      let examples = []
      if (doc) {
        // Strip spaces and asterisks from front of each line
        let jsdoc = doc.replace(/^\s*\*?/mg, '')
        // Parse JSDoc documentation
        const {description, tags} = doctrine.parse(jsdoc, {
          sloppy: true // allow optional parameters to be specified in brackets
        })
        if (!func.description) func.description = description
        else method.description = description
        // Process tags
        for (let tag of tags) {
          switch (tag.title) {
            // Tags which always apply to the function as a whole

            case 'name':
              if (tag.name !== name) throw new Error(`Documentation tag @name with name "${tag.name}" differs from name in function definition`)
              break

            case 'title':
              func.title = tag.description
              break

            case 'summary':
              func.summary = tag.description
              break

            case 'description':
              func.description = tag.description
              break

            // Tags applied to indivdual methods

            case 'param':
              let param = {
                name: tag.name || `par${params.length + 1}`
              }
              if (tag.type) {
                if (tag.type.type === 'RestType') {
                  param.type = _extractType(tag)
                  param.repeats = true
                } else if (tag.type.type === 'NameExpression' && tag.type.name.substring(0, 3) === '___') {
                  param.type = tag.type.name.substring(3)
                  param.extends = true
                } else {
                  param.type = _extractType(tag)
                }
              }
              if (tag.description) param.description = tag.description
              params.push(param)
              break

            case 'return':
              return_ = {}
              if (tag.type) return_.type = _extractType(tag)
              if (tag.description) return_.description = tag.description
              break

            case 'example':
              let example = {
                usage: tag.description
              }
              if (tag.caption) example.caption = tag.caption
              examples.push(example)
              break
          }
        }
      } else {
        // Process each parameter declaration node into a parameter spec
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
              param.default = source.substring(node.right.start, node.right.end)
              break
            default:
              throw new Error(`Unhandled parameter node type "${node.type}"`)
          }
          params.push(param)
        }
      }

      if (params.length || return_ || examples.length) {
        let signature = name + '(' + params.map(param => {
          return param.name + (param.type ? `: ${param.type}` : '')
        }).join(', ') + ')'
        if (return_) signature += `: ${return_.type}`
        method.signature = signature

        if (params.length) method.params = params
        if (return_) method.return = return_
        if (examples.length) method.examples = examples

        methods[signature] = method
      }
    }

    // Ensure that there is always at least one method
    if (Object.values(methods).length === 0) {
      let signature = name + '()'
      methods[signature] = { signature }
    }

    func.methods = methods

    return func
  }

  async execute (cell) {
    // At present, the received cell may not have
    // all the things we need (e.g. outputs etc) from a
    // previous compilation step. So we compile the cell
    // and extract those from there. Only `inputs` (with values)
    // are taken from the received cell
    let compiled = await this.compile(cell, true)
    cell = {
      source: compiled.source,
      expr: cell.expr || false,
      inputs: cell.inputs || [],
      outputs: compiled.outputs,
      messages: compiled.messages
    }

    // Get cell source code adding the return value of function to the code
    // (i.e. simulate implicit return). Although this approach is inefficient,
    // because it involves executing expressions twice, it
    // has the advantage of accurately reporting errors in the correct location
    // in the cell's source code. Other approaches can be investigated later.
    let source = cell.source.data + `;\nreturn ${compiled._return};`

    // Get the names and values of cell inputs
    let inputNames = []
    let inputValues = []
    for (let input of cell.inputs) {
      let {name, value} = input
      if (!name) throw new Error(`Name is required for input`)
      if (!value) throw new Error(`Value is required for input "${name}"`)
      inputNames.push(name)
      // Get the input from variables, if available, otherwise
      // unpack the provided one
      let value_
      if (this._variables.hasOwnProperty(name)) {
        value_ = this._variables[name]
      } else {
        value_ = await this.unpack(value)
      }
      inputValues.push(value_)
    }

    // Construct a function from them
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    const func = new AsyncFunction(...inputNames, source) // eslint-disable-line no-new-func

    // Execute the function, using input values as arguments
    // an converting exceptions into error messages
    let value
    try {
      value = await func(...inputValues)
    } catch (error) {
      let line = 0
      let column = 0
      let message
      if (error.stack) {
        // Parse the error stack to get message, line and columns numbers
        let lines = error.stack.split('\n')
        let match = lines[1].match(/<anonymous>:(\d+):(\d+)/)
        if (match) {
          line = parseInt(match[1], 10) - 2
          column = parseInt(match[2], 10)
        }
        message = lines[0] || error.message
      }
      cell.messages.push({
        type: 'error',
        line: line,
        column: column,
        message: message
      })
    }

    const output = cell.outputs[0]
    if (output) {
      if (output.name) {
        // Register the output as a variable residing in this context
        this._variables[output.name] = value
      }

      if (typeof value === 'undefined') {
        // If the cell has an output but that output is undefined
        // then treat it as an error
        cell.messages.push({
          type: 'error',
          message: 'Cell output value is undefined'
        })
      } else {
        if (typeof value === 'function' && output.value && output.value.type === 'function') {
          // Output value is a function, get it's specification
          let func = await this.unpack(output.value)

          // Attach the specification to the function object
          value._spec = func

          // Attach the function to the specification and
          // register in the library (we may drop this in the future
          // in favour of treating functions just like other variables)
          func.body = value
          if (!this._libraries['local']) this._libraries['local'] = {}
          this._libraries['local'][func.name] = func
        } else {
          // Pack the output value
          output.value = await this.pack(value)
        }
      }
    }

    return cell
  }

  async evaluateCall (call) {
    // Get the function
    const func = await this.evaluate(call.func)

    // Currently, just use the first method
    const method = Object.values(func.methods)[0]

    // Using `method.params` specification, map the call's arguments onto the method's parameters
    let args = []
    let argsIndex = 0
    let argsUsed = 0
    let namedArgs
    let namedArgsUsed = []
    if (method.params) {
      for (let param of method.params) {
        if (param.repeats) {
          // Put the remaining arguments into an array
          let remaining = []
          for (; argsIndex < call.args.length; argsIndex++) {
            remaining.push(await this.evaluate(call.args[argsIndex]))
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
                namedArgs[name] = await this.evaluate(call.namedArgs[name])
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
          if (arg) args.push(await this.evaluate(arg))
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
    let value = namedArgs ? func.body(...args, namedArgs) : func.body(...args)
    if (value !== undefined) call.value = await this.pack(value)

    return call
  }

  async evaluateGet (get) {
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
}

JavascriptContext.spec = {
  name: 'JavascriptContext',
  client: 'ContextHttpClient'
}

module.exports = JavascriptContext
