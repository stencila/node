const fs = require('fs')

const kernelspecs = require('kernelspecs')
const spawnteract = require('spawnteract')

/**
 * A JupyterContext for executing code in Jupyter kernels
 *
 * Note that this class only starts a new Jupyter kernel by 
 * reading what it needs to from the filesystem and running
 * a system command. Communication with the kernel is
 * done by the `JupyterContextClient` in the stencila/stencila repo
 */
class JupyterContext {

  /**
   * Initialize this context class
   *
   * Looks for Jupyter kernels that have been installed on the system
   * and puts an alias in each for in `JupyterContext.spec.aliases`
   * 
   * @return {object} Context specification object
   */
  static initialize () {
    // Create a list of kernel names and aliases 
    return kernelspecs.findAll().then(kernelspecs => {
      JupyterContext.spec.kernels = kernelspecs
    })
  }

  constructor (kernel) {
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
   * Start the context
   * @return {Promise} A promise
   */
  start () {
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
   * Stop the context
   * @return {Promise} A promise
   */
  stop () {
    if (this._process) {
      this._process.kill()
      this._process = null
    }
    if (this._connectionFile) {
      fs.unlink(this._connectionFile)
      this._connectionFile = null
    }
    this.config = null
    this.spec = null
    return Promise.resolve()
  }

}

JupyterContext.spec = {
  name: 'JupyterContext',
  client: 'JupyterContextClient',
  aliases: ['jupyter']
}

module.exports = JupyterContext
