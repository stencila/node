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
  constructor (host, name, options = {}) {
    super(host, name)

    let kernel = options.kernel
    let kernelName = options.name
    const kernels = JupyterContext.spec.kernels
    const kernelNames = Object.keys(kernels)

    if (!kernelNames.length) {
      throw new Error('No Jupyter kernels available on this machine')
    }
    if (kernel && !kernels[kernel]) {
      throw new Error(`Jupyter kernel "${kernel}" not available on this machine`)
    }
    if (kernelName) {
      for (let spec of kernels) {
        if (spec.name.toLowerCase() === kernelName) {
          kernel = spec.name
          break
        }
      }
      if (!kernel) {
        throw new Error(`No Jupyter kernel on this machine with name "${kernelName}"`)
      }
    }
    if (!kernel) {
      if (kernelNames.indexOf('python3') >= 0) kernel = 'python3'
      else kernel = kernelNames[0]
    }
    this.kernel = kernel

    this.debug = options.debug || false
    this.timeout = options.timeout || -1
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
        return this._request('kernel_info_request', {}, ['kernel_info_reply']).then(({request, response}) => {
          this._kernelInfo = response.content
          // This wait seems to be necessary in order for messages to be received on
          // `this._ioSocket`.
          return new Promise((resolve, reject) => {
            setTimeout(resolve, 1000)
          })
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
  async execute (cell) {
    // Compile the cell so it has correct structure
    cell = await this.compile(cell)

    // For expression cells, use `user_expressions`, not `code`
    // to ensure there are no side effects (?)
    let code
    let expressions
    if (cell.expr) {
      code = ''
      expressions = {
        'value': cell.source.data
      }
    } else {
      code = cell.source.data
      expressions = {}
    }

    let content = {
      // Source code to be executed by the kernel, one or more lines.
      'code': code,

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
      'user_expressions': expressions,

      // Some frontends do not support stdin requests.
      // If this is true, code running in the kernel can prompt the user for input
      // with an input_request message (see below). If it is false, the kernel
      // should not send these messages.
      'allow_stdin': false,

      // A boolean flag, which, if True, does not abort the execution queue, if an exception is encountered.
      // This allows the queued execution of multiple execute_requests, even if they generate exceptions.
      'stop_on_error': false
    }
    return this._request('execute_request', content).then(({request, response}) => {
      const msgType = response.header.msg_type
      switch (msgType) {
        case 'execute_result':
          // Success! Unbundle the execution result, insert it into cell
          // outputs and then return the cell
          return this._unbundle(response.content.data).then(value => {
            cell.outputs.push({value})
            return cell
          })
        case 'execute_reply':
          // We get  `execute_reply` messages when there is no
          // execution result (e.g. an assignment), or when evaluating
          // a user expression
          const result = response.content.user_expressions.value
          if (result) {
            if (result.status === 'ok') {
              return this._unbundle(result.data).then(value => {
                cell.outputs.push({value})
                return cell
              })
            } else if (result && result.status === 'error') {
              cell.messages.push({
                type: 'error',
                message: result.ename + ': ' + result.evalue
              })
              return cell
            }
          } else {
            return cell
          }
          break
        case 'error':
          // Errrror :( Add an error message to the cell
          const error = response.content
          cell.messages.push({
            type: 'error',
            message: error.ename + ': ' + error.evalue
          })
          return cell
        default:
          if (this.debug) console.log(`Unhandled message type: ${msgType}`)
      }
    }).catch(error => {
      // Some other error happened...
      cell.messages.push({
        type: 'error',
        message: error.message
      })
      return cell
    })
  }

  /**
   * Send a request message to the kernal
   *
   * @private
   * @param  {String} requestType  Type of request e.g. 'execute'
   * @param  {Object} content      Content of message
   * @param  {String} responseTypes Types of response message to resolve
   * @returns {Promise} Promise resolving to the {request, response} messages
   */
  _request (requestType, content, responseTypes = ['execute_result', 'execute_reply', 'error']) {
    return new Promise((resolve, reject) => {
      var request = new jmp.Message()
      request.idents = []
      request.header = {
        'msg_id': uuid(),
        'username': 'user',
        'session': this._sessionId,
        'msg_type': requestType,
        'version': '5.2'
      }
      request.parent_header = {}
      request.metadata = {}
      request.content = content

      this._requests[request.header.msg_id] = {
        request,
        responseTypes,
        handler: (response) => resolve({request, response})
      }
      this._shellSocket.send(request)

      // If this request has not been handled before `timeout`
      // throw an error
      if (this.timeout >= 0) {
        setTimeout(() => {
          if (this._requests[request.header.msg_id]) {
            reject(new Error('Request timed out'))
          }
        }, this.timeout * 1000)
      }
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
    if (this.debug) {
      console.log('Response: ', requestId, responseType, response.content)
    }
    // First response matching the request, including response type
    // calls handler
    if (request && request.responseTypes.indexOf(responseType) > -1) {
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
