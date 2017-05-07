const {Context} = require('stencila')

/**
 * A JupyterContext for executing code in Jupyter kernels
 *
 * Note that this class only starts a new Jupyter kernel by 
 * reading what it needs to from the filesystem and running
 * a system command. Communication with the kernel is
 * done by the `JupyterContextClient` in the stencila/stencila repo
 *
 * @extends {Context}
 */
class JupyterContext extends Context {

  constructor (kernel) {
    super()

    /**
     * Kernel code (used to connect to the right Jupyter kernel)
     */
    this.kernel = kernel

    // Look for which kernels are available on the machine by listing directories
    // in  `~/.local/share/jupyter/kernels` (on linux)

    // For each kernel, load the kernelspec e.g. `~/.local/share/jupyter/kernels/ir/kernel.json` (on linux)

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

}

JupyterContext.spec = {
  name: 'JupyterContext',
  client: 'JupyterContextClient', // Tell the client host to use a JupyterContextClient for this
  aliases: ['jupyter_ir'] // This needs to get expanded into a list of the available Jupyter kernels
}

module.exports = JupyterContext
