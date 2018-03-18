const fs = require('fs')
const jmp = require('jmp')
const kernelspecs = require('kernelspecs')
const spawnteract = require('spawnteract')
const uuid = require('uuid')

const Context = require('./Context')

/**
 * An execution context using Jupyter kernels
 *
 * This class of execution context acts as a bridge between Stencila and
 * Jupyter kernels. It exposes methods of the Stencila `Context` API e.g. `executeEval`
 * which delegate execution to a Jupyter kernel. This is done via the
 * [Jupyter Messageing Protocol (JMP)](http://jupyter-client.readthedocs.io/en/stable/messaging.html)
 * over [ZeroMQ](http://zeromq.org/) sockets.
 *
 * The `discover` static method should be called initially to find all Jupyter kernels
 * currently installed on the machine and update `JupyterContext.spec.kernels`:
 *
 *     JupyterContext.discover()
 *
 * New Jupyter execution contexts can be constructed using the `language` option which will
 * search for a kernel with a matching lowercased `language` property:
 *
 *     new JupyterContext({language:'r'})
 *
 * Alternively, you can specify a kernel directly:
 *
 *     new JupyterContext({kernel:'ir'})
 *
 * See https://github.com/jupyter/jupyter/wiki/Jupyter-kernels for a list of available
 * Jupyter kernels.
 *
 * Many thanks to the nteract community for [`kernelspecs`](https://github.com/nteract/kernelspecs) and
 * [`spawnteract`](https://github.com/nteract/spawnteract), and to Nicolas Riesco for (`jmp`)[https://github.com/n-riesco/jmp],
 * all of which made this implementation far easier!
 */
class JupyterContext extends Context {
  /**
   * Discover Jupyter kernels on the current machine
   *
   * Looks for Jupyter kernels that have been installed on the system
   * and puts that list in `JupyterContext.spec.kernels` so that
   * peers know the capabilities of this "meta-context".
   *
   * @return {Promise} A promise
   */
  static discover () {
    // Create a list of kernel names and aliases
    return kernelspecs.findAll().then(kernelspecs => {
      JupyterContext.spec.kernels = kernelspecs
    })
  }

  /**
   * Construct a Jupyter execution context
   *
   * @param  {Object} options Options for specifying which kernel to use
   */
  constructor (options = {}) {
    super()

    let kernel = options.kernel
    let name = options.name
    const kernels = JupyterContext.spec.kernels
    const kernelNames = Object.keys(kernels)

    if (!kernelNames.length) {
      throw new Error('No Jupyter kernels available on this machine')
    }
    if (kernel && !kernels[kernel]) {
      throw new Error(`Jupyter kernel "${kernel}" not available on this machine`)
    }
    if (name) {
      for (let spec of kernels) {
        if (spec.name.toLowerCase() === name) {
          kernel = spec.name
          break
        }
      }
      if (!kernel) {
        throw new Error(`No Jupyter kernel on this machine with name "${name}"`)
      }
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
        this._config = kernel.config // Connection information from the file
        this._spec = kernel.kernelSpec

        // Unique session id for requests
        this._sessionId = uuid()

        // Map of requests for handling response messages
        this._requests = {}

        const origin = this._config.transport + '://' + this._config.ip

        // Shell socket for execute, and other, request
        this._shellSocket = new jmp.Socket('dealer', 'sha256', this._config.key)
        this._shellSocket.connect(origin + ':' + this._config.shell_port)
        this._shellSocket.on('message', this._response.bind(this))

        // IOPub socket for receiving updates
        this._ioSocket = new jmp.Socket('sub', 'sha256', this._config.key)
        this._ioSocket.connect(origin + ':' + this._config.iopub_port)
        this._ioSocket.on('message', this._response.bind(this))
        this._ioSocket.subscribe('') // Subscribe to all topics

        // Get kernel info mainly to confirm communication with kernel is
        // working
        this._request('kernel_info').then(({request, response}) => {
          this._kernelInfo = response.content
        })

        // This wait seems to be necessary in order for messages to be received on
        // `this._iosSocket`.
        return new Promise((resolve, reject) => {
          setTimeout(resolve, 1000)
        })
      })
    }
  }

  /**
   * Finalize the context
   *
   * @return {Promise} A resolved promise
   */
  finalize () {
    if (this._shellSocket) {
      this._shellSocket.removeAllListeners('message')
      this._shellSocket.close()
      this._shellSocket = null
    }
    if (this._ioSocket) {
      this._ioSocket.removeAllListeners('message')
      this._ioSocket.close()
      this._ioSocket = null
    }
    if (this._process) {
      this._process.kill()
      this._process = null
    }
    if (this._connectionFile) {
      fs.unlinkSync(this._connectionFile)
      this._connectionFile = null
    }
    this._config = null
    this._spec = null
    return Promise.resolve()
  }

  /**
   * Execute an "evaluate" operation (i.e. a `eval` node)
   *
   * Utilises `user_expressions` property of an `execute_request` to
   * evaluate expression side-effect free.
   *
   * @override
   */
  executeEval (eva) {
    let content = {
      // See `_executeRun` method for a description of these properties
      'code': '',
      'silent': false,
      'store_history': false,
      'user_expressions': {
        'eval': eva.source.data
      },
      'allow_stdin': false,
      'stop_on_error': false
    }
    return this._request('execute', content, 'execute_reply').then(({request, response}) => {
      const eva = response.content.user_expressions.eval
      if (eva && eva.status === 'ok') {
        return this._unbundle(eva.data)
      } else {
        return Promise.reject(new Error()) // TODO
      }
    })
  }

  /**
   * Execute a "run" operation (i.e. a `run` node)
   *
   * @override
   */
  executeRun (run) {
    let content = {
      // Source code to be executed by the kernel, one or more lines.
      'code': run.source.data,

      // A boolean flag which, if True, signals the kernel to execute
      // this code as quietly as possible.
      // silent=True forces store_history to be False,
      // and will *not*:
      //   - broadcast output on the IOPUB channel
      //   - have an execute_result
      // The default is False.
      'silent': false,

      // A boolean flag which, if True, signals the kernel to populate history
      // The default is True if silent is False.  If silent is True, store_history
      // is forced to be False.
      'store_history': true,

      // A dict mapping names to expressions to be evaluated in the
      // user's dict. The rich display-data representation of each will be evaluated after execution.
      // See the display_data content for the structure of the representation data.
      'user_expressions': {},

      // Some frontends do not support stdin requests.
      // If this is true, code running in the kernel can prompt the user for input
      // with an input_request message (see below). If it is false, the kernel
      // should not send these messages.
      'allow_stdin': false,

      // A boolean flag, which, if True, does not abort the execution queue, if an exception is encountered.
      // This allows the queued execution of multiple execute_requests, even if they generate exceptions.
      'stop_on_error': false
    }
    return this._request('execute', content, 'execute_result').then(({request, response}) => {
      return this._unbundle(response.content.data)
    })
  }

  /**
   * Send a request message to the kernal
   *
   * @private
   * @param  {String} requestType  Type of request e.g. 'execute'
   * @param  {Object} content      Content of message
   * @param  {String} responseType Type of response message to resolve
   * @returns {Promise} Promise resolving to the {request, response} messages
   */
  _request (requestType, content = {}, responseType = null) {
    responseType = responseType || (requestType + '_reply')
    return new Promise((resolve, reject) => {
      var request = new jmp.Message()
      request.idents = []
      request.header = {
        'msg_id': uuid(),
        'username': 'user',
        'session': this._sessionId,
        'msg_type': requestType + '_request',
        'version': '5.2'
      }
      request.parent_header = {}
      request.metadata = {}
      request.content = content

      this._requests[request.header.msg_id] = {
        request,
        responseType,
        handler: (response) => resolve({request, response})
      }
      this._shellSocket.send(request)
    })
  }

  /**
   * Receive a response message from the kernel
   *
   * @private
   * @param  {Message} response Response message
   */
  _response (response) {
    const requestId = response.parent_header.msg_id
    const responseType = response.header.msg_type
    const request = this._requests[requestId]
    // console.log(requestId, request, response, responseType, response.content)
    // First response matching the request, including response type
    // calls handler
    if (request && request.responseType === responseType) {
      request.handler(response)
      delete this._requests[requestId]
    }
  }

  /**
   * Convert a "MIME bundle" within a JMP message (e.g. a `execute_result` or
   * `display data` message) into a data node
   * e.g. `{'text/plain': 'Hello'}` to `{type: 'string', data: 'Hello'}`
   *
   * @private
   * @param  {Object} bundle A JMP MIME bundle
   * @return {Promise}       Promise resolving to a data node
   */
  _unbundle (bundle) {
    return Promise.resolve().then(() => {
      const text = bundle['text/plain']
      if (text) {
        // Attempt to parse to JSON
        try {
          return JSON.parse(text)
        } catch (error) {
          return text
        }
      }
    }).then(value => {
      return this.pack(value)
    })
  }
}

JupyterContext.spec = {
  name: 'JupyterContext',
  client: 'ContextHttpClient',
  kernels: {} // Populated by JupyterContext.setup
}

module.exports = JupyterContext
