const acorn = require('acorn')
const doctrine = require('doctrine')
const { generate } = require('astring')
const walk = require('acorn/dist/walk')

const Context = require('./Context')

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
  }

  /**
   * Get the libraries registered in this context
   *
   * @return {[type]} [description]
   */
  async libraries () {
    return this._libraries
  }

  /**
   * Compile a cell
   */
  async compile (cell) {
    // Cell source code
    let source
    if (typeof cell === 'string' || cell instanceof String) {
      source = cell
    } else if (typeof cell === 'function') {
      source = cell.toString()
    } else {
      source = cell.source.data
    }

    // Input values
    let inputs = []

    // Output name and value (currently assuming a single output)
    let name
    let value

    // A code expression to execute to get the return value
    // (not applicable to function outputs)
    let _result = null

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

    if (messages.length === 0) {
      // Determine which names are declared and which are used
      let declared = []
      walk.simple(ast, {
        FunctionDeclaration (node) {
          declared.push(node.id.name)
        },
        VariableDeclarator: node => {
          declared.push(node.id.name)
        },
        Identifier: node => {
          let name = node.name
          if (declared.indexOf(name) < 0) inputs.push({ name })
        }
      })

      // If the last top level node in the AST is a FunctionDeclaration,
      // VariableDeclaration or Identifier then use it's name as the output name
      let last = ast.body.pop()
      if (last) {
        if (last.type === 'FunctionDeclaration') {
          name = last.id.name
          value = this._compileFunction(name, last, source, docs)
        } else if (last.type === 'ExportDefaultDeclaration') {
          // Currenly only handle exported functions
          const decl = last.declaration
          if (decl.type === 'FunctionDeclaration') {
            name = decl.id.name
            value = this._compileFunction(name, decl, source, docs)
          }
        } else if (last.type === 'VariableDeclaration') {
          name = last.declarations[0].id.name
          _result = name
        } else if (last.type === 'ExpressionStatement') {
          if (last.expression.type === 'Identifier') {
            name = last.expression.name
          }
          _result = generate(last)
        } else {
          // During development it can be useful to turn this on
          // throw new Error('Unhandled AST node type: ' + last.type)
        }
      }
    }

    let output = {}
    if (name) output.name = name
    if (value) output.value = await this.pack(value)
    let outputs = Object.keys(output).length ? [output] : []

    return {
      type: 'cell',
      source: {
        type: 'text',
        lang: 'js',
        data: source
      },
      inputs,
      outputs,
      messages
    }
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
        let signature = name + '(' + params.map(param => `${param.name}: ${param.type}`).join(', ') + ')'
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
    cell = await this.compile(cell)

    for (let output of cell.outputs || []) {
      let value = await this.unpack(output.value)
      if (value.type === 'function') {
        // 'Execute' a function defintition by evaluating it's source code and
        // putting it into the 'local' library
        let source = cell.source.data
        value.body = eval(source + ';' + value.name) // eslint-disable-line no-eval

        if (!this._libraries['local']) this._libraries['local'] = {}
        this._libraries['local'][value.name] = value
      }
    }
    // const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
    // const func = new AsyncFunction('return ' + code) // eslint-disable-line no-new-func
    // const value = await func()
    // cell.output = { value: this.pack(value) }
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
