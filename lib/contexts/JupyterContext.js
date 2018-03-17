const fs = require('fs')
const kernelspecs = require('kernelspecs')
const spawnteract = require('spawnteract')

/**
 * A JupyterContext for executing code in Jupyter kernels
 *
 * Note that this class only starts a new Jupyter kernel by
 * reading what it needs to from the filesystem and running
 * a system command.
 */
class JupyterContext {
  /**
   * Setup this context class
   *
   * Looks for Jupyter kernels that have been installed on the system
   * and puts that list in `JupyterContext.spec.kernels` so that
   * peers know the capabilities of this "meta-context"
   *
   * @return {object} Context specification object
   */
  static setup () {
    // Create a list of kernel names and aliases
    return kernelspecs.findAll().then(kernelspecs => {
      JupyterContext.spec.kernels = kernelspecs
    })
  }

  constructor (options = {}) {
    let kernel = options.kernel
    const kernels = JupyterContext.spec.kernels
    const kernelNames = Object.keys(kernels)

    if (!kernelNames.length) {
      throw new Error('No Jupyter kernels available on this machine')
    }
    if (kernel && !kernels[kernel]) {
      throw new Error(`Jupyter kernel "${kernel}" not available on this machine`)
    }
    if (!kernel) {
      if (kernelNames.indexOf('python3') >= 0) kernel = 'python3'
      else kernel = kernelNames[0]
    }
    this.kernel = kernel
  }

  /**
   * Initialize the context
   *
   * @return {Promise} A promise
   */
  initialize () {
    if (this._process) return Promise.resolve()
    else {
      // Options to [child_process.spawn]{@link https://nodejs.org/api/child_process.html#child_process_child_process_spawn_command_args_options}
      let options = {}
      // Pass `kernels` to `launch()` as an optimization to prevent another kernelspecs search of filesystem
      return spawnteract.launch(this.kernel, options, JupyterContext.spec.kernels).then(kernel => {
        this._process = kernel.spawn // The running process, from child_process.spawn(...)
        this._connectionFile = kernel.connectionFile // Connection file path
        this.config = kernel.config // Connection information from the file
        this.spec = kernel.kernelSpec
      })
    }
  }

  /**
   * Finalize the context
   *
   * @return {Promise} A promise
   */
  finalize () {
    if (this._process) {
      this._process.kill()
      this._process = null
    }
    if (this._connectionFile) {
      fs.unlinkSync(this._connectionFile)
      this._connectionFile = null
    }
    this.config = null
    this.spec = null
    return Promise.resolve()
  }

  /**
   * Run code within the context's global scope
   *
   * @param {string} code - Code to run
   * @return {object} - A Promise resolving to object with any `errors` and `output`
   */
  runCode (code) {
    return Promise.reject(new Error('Not implemented'))
  }
}

JupyterContext.spec = {
  name: 'JupyterContext',
  client: 'ContextHttpClient',
  kernels: {} // Populated by JupyterContext.setup
}

module.exports = JupyterContext
