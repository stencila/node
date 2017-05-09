const kernelspecs = require('kernelspecs')

/**
 * A JupyterContext for executing code in Jupyter kernels
 *
 * Note that this class only starts a new Jupyter kernel by 
 * reading what it needs to from the filesystem and running
 * a system command. Communication with the kernel is
 * done by the `JupyterContextClient` in the stencila/stencila repo
 */
class JupyterContext {

  constructor (kernel) {

    /**
     * Kernel code (used to connect to the right Jupyter kernel)
     */
    this.kernel = kernel

    // Create a connection object e.g. 
    this.connection =  {
      ip: "127.0.0.1",
      transport: "tcp",
      // These port numbers should be dynamic
      control_port: 50160,
      shell_port: 57503,        
      stdin_port: 52597,
      hb_port: 42540,
      iopub_port: 40885,
      signature_scheme: "hmac-sha256",
      key: "a0436f6c-1916-498b-8eb9-e81ab9368e84"
    }

    // Save the connection object to a "connection file"

    // Run the commands specified in the kernelspec with the connection file as argument
    // to launch the kernel
    
    // `JupyterContextClient` will request this info in a GET so that it can connect
    // directly to the Jupyter kernel

  }

  /**
   * Initialize this context class
   *
   * Looks for Jupyter kernels that have been installed on the system
   * and puts an alias in each for in `JupyterContext.spec.aliases`
   * 
   * @return {object} Context specification object
   */
  static initialize () {
    // Create a list of kernel aliases 
    return kernelspecs.findAll().then(kernelspecs => {
      let aliases = []
      for (let name of Object.keys(kernelspecs)) {
        //let kernelspec = kernelspecs[name]
        aliases.push(`jupyter(${name})`)
        aliases.push(name)
      }
      JupyterContext.spec.aliases = aliases
    })
  }

}

JupyterContext.spec = {
  name: 'JupyterContext',
  client: 'JupyterContextClient', // Tell the client host to use a JupyterContextClient for this
  aliases: [] // Aliases for each kernelspec installed on this machine. Populated by updateSpec()
}

module.exports = JupyterContext
