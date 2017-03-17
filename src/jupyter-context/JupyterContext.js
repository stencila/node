const {Context, value} = require('stencila')

/**
 * A context for executing code within a Jupyter kernel
 *
 * Currently this is just a very preliminary stub with some ideas for implementation
 *
 * @extends {Context}
 */
class JupyterContext extends Context {

  constructor (language, kernel) {
    super()

    /**
     * Langauge code for this context. Used as the basis for
     * wrapper code
     */
    this.langauage = language

    /**
     * Kernel code (? used to connect to the right Jupyter kernel)
     */
    this.kernel = kernel
  }

  /**
   * Run code within the context's global scope (i.e. execute a code "chunk")
   *
   * @override
   */
  runCode (code, options) {
    // Ask the kernel to execute the code

    // Get the `execute_result` or `display_data` and pack it
    // from mimetype -> value -> pack

    return Promise.resolve()
  }

  /**
   * Execute code within a local function scope (i.e. execute a code "cell")
   *
   * @override
   */
  callCode (code, args, options) {
    // Do we need to initialize the kernel with functions for pack/unpack/value for each language

    // Wrap the code into a "self executing function"
    let wrapper = callCodeWrappers[this.language]
    let selfExecFunc = wrapper(code, args)

    // Ask the kernel to execute the code
    //selfExecFunc

    // Get the `execute_result` or `display_data` and pack it

    return this.runCode(func)
  }

  /**
   * Does the context provide a function?
   *
   * @override
   */
  hasFunction (name) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
   * Call a function
   *
   * @override
   */
  callFunction (name, args, options) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
   * Get the dependencies for a piece of code
   *
   * @override
   */
  codeDependencies (code) {
    return Promise.reject(new Error('Not implemented'))
  }

  /**
   * Complete a piece of code
   *
   * @override
   */
  codeComplete (code) {
    return Promise.reject(new Error('Not implemented'))
  }
}

const callCodeWrappers = {
  r: (code, args) => {
    return `(function(${Object.keys(args)}) { ${code} })()`
  }
}

module.exports = JupyterContext
