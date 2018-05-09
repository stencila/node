const test = require('tape')

const { testAsync } = require('../helpers')
const JavascriptContext = require('../../lib/contexts/JavascriptContext')

test('JavascriptContext', assert => {
  const context = new JavascriptContext()

  assert.ok(context instanceof JavascriptContext)
  assert.end()
})

testAsync('JavascriptContext.compile', async assert => {
  let context = new JavascriptContext()

  // Empty string
  assert.deepEqual(await context.compile(''), {
    type: 'cell',
    source: {
      type: 'string',
      data: ''
    },
    inputs: [],
    outputs: [],
    messages: []
  }
  )

  // Syntax error
  assert.deepEqual(await context.compile('foo bar()'), {
    type: 'cell',
    source: {
      type: 'string',
      data: 'foo bar()'
    },
    inputs: [],
    outputs: [],
    messages: [{
      type: 'error',
      message: 'Syntax error in Javascript: Unexpected token (1:4)',
      line: 1,
      column: 4
    }]
  }
  )

  async function check (source, expected) {
    const result = await context.compile(source)
    assert.deepEqual(
      (({inputs, outputs}) => ({inputs, outputs}))(result),
      expected,
      source
    )
  }

  // Global variables are not inputs
  await check('Math.pi', {
    inputs: [],
    outputs: [{}]
  })

  await check('const foo = require("foo")\nfoo.bar', {
    inputs: [],
    outputs: [{}]
  })

  // Non-global, undeclared variables are inputs
  await check('const result = specialFunc()', {
    inputs: [{name: 'specialFunc'}],
    outputs: [{name: 'result'}]
  })

  await check('specialMath.pi', {
    inputs: [{name: 'specialMath'}],
    outputs: [{}]
  })

  // Last statement is an undeclared variable
  await check('foo', {
    inputs: [{name: 'foo'}],
    outputs: [{name: 'foo'}]
  })

  // Last statement is a declaration

  await check('var foo', {
    inputs: [],
    outputs: [{name: 'foo'}]
  })

  await check('const foo = 1', {
    inputs: [],
    outputs: [{name: 'foo'}]
  })

  // Last statement is name of locally declared variable

  await check('var foo\nfoo', {
    inputs: [],
    outputs: [{name: 'foo'}]
  })

  await check('let foo\nfoo', {
    inputs: [],
    outputs: [{name: 'foo'}]
  })

  await check('const foo = 1\nfoo', {
    inputs: [],
    outputs: [{name: 'foo'}]
  })

  await check('var foo = 1\nfoo', {
    inputs: [],
    outputs: [{name: 'foo'}]
  })

  // Last statement is a declaration with multiple declarations (first identifier used)
  await check('foo\nbar\nlet baz, urg\n\n', {
    inputs: [{name: 'foo'}, {name: 'bar'}],
    outputs: [{name: 'baz'}]
  })

  // Only top level variable declarations are considered when
  // determining cell inputs
  await check(`
    let a;
    {var c};
    for (let b in [1,2,3]){};
    if (true) { const d = 1 };
    function f () { let e = 2 };
    a * b * c * d * e;
  `, {
    inputs: [{name: 'b'}, {name: 'c'}, {name: 'd'}, {name: 'e'}],
    outputs: [{}]
  })

  // Last statement is not a declaration or identifier
  await check('let foo\nbar\nlet baz\ntrue', {
    inputs: [{name: 'bar'}],
    outputs: [{}]
  })

  // Variable declaration after usage (this will be a runtime error but this tests static analysis of code regardless)
  await check('foo\nlet foo\n', {
    inputs: [{name: 'foo'}],
    outputs: [{name: 'foo'}]
  })

  // Last statement is an expression (producing an unnamed output)

  await check('true', {
    inputs: [],
    outputs: [{}]
  })

  await check('foo * 3', {
    inputs: [{name: 'foo'}],
    outputs: [{}]
  })

  await check('var foo = 1\nfoo * 3', {
    inputs: [],
    outputs: [{}]
  })

  await check('let z = x * y;\n(z * 2)', {
    inputs: [{name: 'x'}, {name: 'y'}],
    outputs: [{}]
  })

  assert.end()
})

testAsync('JavascriptContext.compile expression', async assert => {
  let context = new JavascriptContext()

  async function check (source, expected) {
    const result = await context.compile({
      source: {
        type: 'string',
        data: source
      },
      expr: true
    })
    assert.deepEqual(
      (({inputs, outputs, messages}) => ({inputs, outputs, messages}))(result),
      expected,
      source
    )
  }

  await check('42', {
    inputs: [],
    outputs: [{}],
    messages: []
  })

  await check('x * 3', {
    inputs: [{name: 'x'}],
    outputs: [{}],
    messages: []
  })

  await check('let y = x * 3', {
    inputs: [],
    outputs: [],
    messages: [{ type: 'error', message: 'Cell source code must be a single, simple Javascript expression' }]
  })

  await check('y = x * 3', {
    inputs: [],
    outputs: [],
    messages: [{ type: 'error', message: 'Cell source code must be a single, simple Javascript expression' }]
  })

  await check('x++', {
    inputs: [],
    outputs: [],
    messages: [{ type: 'error', message: 'Cell source code must be a single, simple Javascript expression' }]
  })

  await check('y--', {
    inputs: [],
    outputs: [],
    messages: [{ type: 'error', message: 'Cell source code must be a single, simple Javascript expression' }]
  })

  await check('function foo(){}', {
    inputs: [],
    outputs: [],
    messages: [{ type: 'error', message: 'Cell source code must be a single, simple Javascript expression' }]
  })

  assert.end()
})

testAsync('JavascriptContext.compile function', async assert => {
  let context = new JavascriptContext()

  function afunc (x, y) { return x * y }
  assert.deepEqual(
    await context.compile(afunc),
    {
      type: 'cell',
      source: {
        type: 'string',
        data: 'function afunc(x, y) { return x * y }'
      },
      inputs: [],
      outputs: [{
        name: 'afunc',
        value: {
          type: 'function',
          data: {
            type: 'function',
            name: 'afunc',
            methods: {
              'afunc(x, y)': {
                signature: 'afunc(x, y)',
                params: [
                  {name: 'x'},
                  {name: 'y'}
                ]
              }
            }
          }
        }
      }],
      messages: []
    }
  )

  // Check parameters parsed from function declaration and doc comments
  async function checkParams (source, expect, message) {
    let cell = await context.compile(source)
    let func = cell.outputs[0].value.data
    let params = Object.values(func.methods)[0].params
    assert.deepEqual(params, expect, message)
  }

  await checkParams('function func (){}', undefined, 'no parameters')
  await checkParams('function func (a){}', [{name: 'a'}], 'one parameter')
  await checkParams('function func (a, b, c){}', [{name: 'a'}, {name: 'b'}, {name: 'c'}], 'three parameters')

  await checkParams('function func (...a){}', [{name: 'a', repeats: true}], 'one repeatable parameters')

  await checkParams('function func (___a){}', [{name: 'a', extends: true}], 'one extensible parameters')

  // Currently, do not attempt to parse parameter defaults into values
  await checkParams('function func (a=1){}', [{name: 'a', default: '1'}], 'a parameter with a number default')
  await checkParams('function func (a="foo"){}', [{name: 'a', default: '"foo"'}], 'a parameter with a number default')
  await checkParams('function func (a=[1, 2, 3]){}', [{name: 'a', default: '[1, 2, 3]'}], 'a parameter with an array default')
  await checkParams('function func (a={b:1, c:2}){}', [{name: 'a', default: '{b:1, c:2}'}], 'a parameter with an array default')

  await checkParams(`
    /**
     * @param a Description of parameter a
     * @param {typeB} b Description of parameter b
     */
    function func (a, b){}
  `, [
    {name: 'a', description: 'Description of parameter a'},
    {name: 'b', type: 'typeB', description: 'Description of parameter b'}
  ], 'parameter descriptions and types from docs')

  await checkParams(`
    /**
     * @param {...number} pars Description of parameters
     */
    function func (...pars){}
  `, [
    {name: 'pars', type: 'number', repeats: true, description: 'Description of parameters'}
  ], 'repeatable parameter with type specified and elipses')

  await checkParams(`
    /**
     * @param {___number} pars Description of parameters
     */
    function func (___pars){}
  `, [
    {name: 'pars', type: 'number', extends: true, description: 'Description of parameters'}
  ], 'extensible parameter with type specified')

  // Check return parsed from doc comment
  async function checkReturn (source, expect, message) {
    let cell = await context.compile(source)
    let func = cell.outputs[0].value.data
    let return_ = Object.values(func.methods)[0]['return']
    assert.deepEqual(return_, expect, message)
  }

  await checkReturn(
    `function func (){}`,
    undefined,
    'return can only come from doc comment'
  )

  await checkReturn(
    `
    /**
     * @return {typeReturn} Description of return
     */
    function func (a, b){}
    `,
    {type: 'typeReturn', description: 'Description of return'},
    'return description and type from docs'
  )

  // Check example parsed from doc comment
  assert.deepEqual(
    Object.values((await context.compile(`
    /**
     * @example func(ex1)
     * @example <caption>Example 2 function</caption> func(ex2)
     */
    function func (a, b){}
    `)).outputs[0].value.data.methods)[0].examples,
    [
      {
        usage: 'func(ex1)'
      }, {
        usage: 'func(ex2)',
        caption: 'Example 2 function'
      }
    ],
    'examples from docs'
  )

  // Kitchen sink test
  const src1 = `
    /**
     * Function description
     * 
     * @title Function title
     * @summary Function summary
     *
     * @example <caption>Example caption</caption>
     *
     * funcname(1, 2, 3, 4)
     * 
     * @example
     *
     * funcname(x, y, z)
     *
     * @param  {par1Type} par1 Parameter one description
     * @param  {...any} par2 Parameter two description
     * @return {returnType} Return description
     */
    function funcname(par1, ...par2){
      return par1 + sum(par2)
    }
  `
  let func1 = (await context.compile(src1, false)).outputs[0].value.data
  assert.deepEqual(func1, {
    type: 'function',
    name: 'funcname',
    title: 'Function title',
    summary: 'Function summary',
    description: 'Function description',
    methods: {
      'funcname(par1: par1Type, par2: any): returnType': {
        signature: 'funcname(par1: par1Type, par2: any): returnType',
        params: [
          {
            name: 'par1',
            type: 'par1Type',
            description: 'Parameter one description'
          }, {
            name: 'par2',
            repeats: true,
            type: 'any',
            description: 'Parameter two description'
          }
        ],
        return: {
          type: 'returnType',
          description: 'Return description'
        },
        examples: [
          {
            usage: 'funcname(1, 2, 3, 4)',
            caption: 'Example caption'
          }, {
            usage: 'funcname(x, y, z)'
          }
        ]
      }
    }
  }, 'kitchensink example')

  // Overloading
  const src2 = `
    /**
     * Function description: I have two methods
     */
    /**
     * Overload A description
     *
     * @param  {parA1Type} parA1 Parameter A1 description
     * @return {returnAType} Return A description
     */
    /**
     * Overload B description
     *
     * @param  {parB1Type} parB1 Parameter B1 description
     * @return {returnBType} Return B description
     */
    function funcname(...args){}
  `
  let func2 = (await context.compile(src2)).outputs[0].value.data
  assert.equal(func2.description, 'Function description: I have two methods')
  assert.equal(Object.keys(func2.methods).length, 2)
  assert.deepEqual(func2.methods, {
    'funcname(parA1: parA1Type): returnAType': {
      signature: 'funcname(parA1: parA1Type): returnAType',
      description: 'Overload A description',
      params: [
        { name: 'parA1', type: 'parA1Type', description: 'Parameter A1 description' }
      ],
      return: { type: 'returnAType', description: 'Return A description' }
    },
    'funcname(parB1: parB1Type): returnBType': {
      signature: 'funcname(parB1: parB1Type): returnBType',
      description: 'Overload B description',
      params: [
        { name: 'parB1', type: 'parB1Type', description: 'Parameter B1 description' }
      ],
      return: { type: 'returnBType', description: 'Return B description' }
    }
  })

  assert.end()
})

testAsync('JavascriptContext.execute', async assert => {
  let context = new JavascriptContext()

  async function check (source, inputs = [], output = undefined) {
    for (let input of inputs) {
      input.value = await context.pack(input.value)
    }

    const result = await context.execute({
      type: 'cell',
      source: {
        type: 'string',
        data: source
      },
      inputs: inputs
    })

    let outputs = output ? [output] : []
    for (let output of outputs) {
      output.value = await context.pack(output.value)
    }

    assert.deepEqual(result.outputs, outputs, source)
  }

  // No output
  await check('')
  await check('if(true){\n  let x = 4\n}\n')

  // Output value but no name
  await check('42', [], {value: 42})
  await check('1.1 * 2', [], {value: 2.2})
  await check('let x = 3\nMath.sqrt(x*3)', [], {value: 3})
  await check('// Multiple lines and comments\nlet x = {}\nObject.assign(x, {\na:1\n})\n', [], {value: { a: 1 }})

  // Falsy output values
  await check('false', [], {value: false})
  await check('null', [], {value: null})
  await check('0', [], {value: 0})

  // Undefined output values create an error message
  const undefinedMessages = [ { type: 'error', message: 'Cell output value is undefined' } ]
  assert.deepEqual(
    (await context.execute('undefined')).messages,
    undefinedMessages
  )
  assert.deepEqual(
    (await context.execute('Math.non_existant')).messages,
    undefinedMessages
  )

  // Output value and name
  await check('let b = 1', [], {name: 'b', value: 1})
  await check('let c = 1\nc', [], {name: 'c', value: 1})

  // Inputs value and name
  await check('x * 3', [{name: 'x', value: 6}], {value: 18})
  await check('let z = x * y;\n(z * 2).toString()', [
    {name: 'x', value: 2},
    {name: 'y', value: 3}
  ], {value: '12'})

  assert.end()
})

testAsync('JavascriptContext.errors', async assert => {
  let context = new JavascriptContext()

  await context.execute({
    type: 'cell',
    source: {
      type: 'string',
      data: 'source'
    },
    inputs: []
  })

  assert.end()
})

testAsync('JavascriptContext.evaluateCall', async assert => {
  let context = new JavascriptContext()

  async function testCall (call, expect, message) {
    let result = await context.evaluateCall(call)
    assert.deepEqual(result.value, expect, message)
  }

  async function testCallThrows (call, expect, message) {
    try {
      await context.evaluateCall(call)
      assert.fail(message)
    } catch (error) {
      assert.equal(error.message, expect, message)
    }
  }

  function no_pars () { // eslint-disable-line camelcase
    return 'Hello!'
  }
  await context.execute(no_pars)

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'no_pars'}
    }, {
      type: 'string',
      data: 'Hello!'
    },
    'no_pars()'
  )

  await testCallThrows(
    {
      type: 'call',
      func: {type: 'get', name: 'no_pars'},
      args: [
        {type: 'number', data: 42}
      ]
    },
    'Function was supplied 1 extra arguments',
    'no_pars(42)'
  )

  function one_par (par) { // eslint-disable-line camelcase
    return par * 3
  }
  await context.execute(one_par)

  await testCallThrows(
    {
      type: 'call',
      func: {type: 'get', name: 'one_par'}
    },
    'Function parameter "par" must be supplied'
  )

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'one_par'},
      args: [
        {type: 'number', data: 1}
      ]
    }, {
      type: 'number',
      data: 3
    },
    'one_par(1)'
  )

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'one_par'},
      namedArgs: {
        par: {type: 'number', data: 2}
      }
    }, {
      type: 'number',
      data: 6
    },
    'one_par(par=1)'
  )

  await testCallThrows(
    {
      type: 'call',
      func: {type: 'get', name: 'one_par'},
      args: [
        {type: 'number', data: 1}
      ],
      namedArgs: {
        par: {type: 'number', data: 2}
      }
    },
    'Function was supplied 1 extra arguments',
    'one_par(1, par=2)'
  )

  await testCallThrows(
    {
      type: 'call',
      func: {type: 'get', name: 'one_par'},
      namedArgs: {
        par: {type: 'number', data: 1},
        extra1: {type: 'number', data: 2},
        extra2: {type: 'number', data: 3}
      }
    },
    'Function was supplied extra named arguments "extra1", "extra2"',
    'one_par(par=1, extra1=2, extra2=3)'
  )

  function three_pars (par1, par2, par3) { // eslint-disable-line camelcase
    return {par1, par2, par3}
  }
  await context.execute(three_pars)

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'three_pars'},
      namedArgs: {
        par1: {type: 'number', data: 1},
        par2: {type: 'string', data: 'a'},
        par3: {type: 'number', data: 3}
      }
    }, {
      type: 'object',
      data: {par1: 1, par2: 'a', par3: 3}
    },
    'three_pars(par1=1, par2="a", par3=3)'
  )

  function default_par (par1, par2 = 'beep') { // eslint-disable-line camelcase
    return par1 + ' ' + par2
  }
  await context.execute(default_par)

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'default_par'},
      args: [
        {type: 'string', data: 'beep'},
        {type: 'string', data: 'bop'}
      ]
    }, {
      type: 'string',
      data: 'beep bop'
    },
    'default_par("beep", "bop")'
  )

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'default_par'},
      args: [
        {type: 'string', data: 'beep'}
      ]
    }, {
      type: 'string',
      data: 'beep beep'
    },
    'default_par("beep")'
  )

  function repeats_par (arg1, ...args) { // eslint-disable-line camelcase
    return `${arg1} ${args.join(',')}`
  }
  await context.execute(repeats_par)

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'repeats_par'},
      args: [
        {type: 'string', data: 'bar'},
        {type: 'string', data: 'baz'},
        {type: 'string', data: 'boop'}
      ]
    }, {
      type: 'string',
      data: 'bar baz,boop'
    },
    'repeats_par("bar", "baz", "boop")'
  )

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'repeats_par'},
      args: [
        {type: 'string', data: 'bar'}
      ]
    }, {
      type: 'string',
      data: 'bar '
    },
    'repeats_par("bar")'
  )

  function extends_par (arg1, ___args) { // eslint-disable-line camelcase
    return `${arg1} ${___args ? Object.entries(___args).map(entry => entry.join(':')).join(' ') : ''}`
  }
  await context.execute(extends_par)

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'extends_par'},
      args: [
        {type: 'number', data: 1}
      ]
    }, {
      type: 'string',
      data: '1 '
    },
    'extends_par(1)'
  )

  await testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'extends_par'},
      args: [
        {type: 'number', data: 1}
      ],
      namedArgs: {
        a: {type: 'number', data: 1},
        b: {type: 'number', data: 2},
        c: {type: 'number', data: 3}
      }
    }, {
      type: 'string',
      data: '1 a:1 b:2 c:3'
    },
    'extends_par(1, a=1, b=2, c=3)'
  )

  assert.end()
})
