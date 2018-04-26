const test = require('tape')

const JavascriptContext = require('../../lib/contexts/JavascriptContext')

test('JavascriptContext', assert => {
  const context = new JavascriptContext()

  assert.ok(context instanceof JavascriptContext)
  assert.end()
})

test('JavascriptContext.compileFunc', async assert => {
  let context = new JavascriptContext()

  // Test that bad inputs are handled OK
  try {
    await context.compileFunc('')
  } catch (error) {
    assert.ok(error.message.match(/^No function definition found in the source code/), 'throws if no function defined')
  }
  try {
    await context.compileFunc('foo bar()')
    assert.fail('shouldn\'t get here')
  } catch (error) {
    assert.pass('throws if syntax error')
  }

  function afunc () {}
  assert.deepEqual(
    await context.compileFunc(afunc),
    {
      type: 'func',
      name: 'afunc',
      signature: 'afunc()',
      source: { type: 'text', lang: 'js', data: 'function afunc() {}' }
    }
  )

  // Check parameters parsed from function declaration and doc comments
  async function checkParams (source, expect, message) {
    assert.deepEqual((await context.compileFunc(source)).params, expect, message)
  }

  checkParams('function func (){}', undefined, 'no parameters')
  checkParams('function func (a){}', [{name: 'a'}], 'one parameter')
  checkParams('function func (a, b, c){}', [{name: 'a'}, {name: 'b'}, {name: 'c'}], 'three parameters')

  checkParams('function func (...a){}', [{name: 'a', repeats: true}], 'one repeatable parameters')

  checkParams('function func (___a){}', [{name: 'a', extends: true}], 'one extensible parameters')

  // Currently, do not attempt to parse parameter defaults into values
  checkParams('function func (a=1){}', [{name: 'a', default: '1'}], 'a parameter with a number default')
  checkParams('function func (a="foo"){}', [{name: 'a', default: '"foo"'}], 'a parameter with a number default')
  checkParams('function func (a=[1, 2, 3]){}', [{name: 'a', default: '[1, 2, 3]'}], 'a parameter with an array default')
  checkParams('function func (a={b:1, c:2}){}', [{name: 'a', default: '{b:1, c:2}'}], 'a parameter with an array default')

  checkParams(`
    /**
     * @param a Description of parameter a
     * @param {typeB} b Description of parameter b
     */
    function func (a, b){}
  `, [
    {name: 'a', description: 'Description of parameter a'},
    {name: 'b', type: 'typeB', description: 'Description of parameter b'}
  ], 'parameter descriptions and types from docs')

  checkParams(`
    /**
     * @param {...number} pars Description of parameters
     */
    function func (...pars){}
  `, [
    {name: 'pars', type: 'number', repeats: true, description: 'Description of parameters'}
  ], 'repeatable parameter with type specified and elipses')

  checkParams(`
    /**
     * @param {___number} pars Description of parameters
     */
    function func (___pars){}
  `, [
    {name: 'pars', type: 'number', extends: true, description: 'Description of parameters'}
  ], 'extensible parameter with type specified')

  // Check return parsed from doc comment
  async function checkReturn (source, expect, message) {
    assert.deepEqual((await context.compileFunc(source))['return'], expect, message)
  }

  checkReturn(
    `function func (){}`,
    undefined,
    'return can only come from doc comment'
  )

  checkReturn(
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
    (await context.compileFunc(`
    /**
     * @example func(ex1)
     * @example <caption>Example 2 function</caption> func(ex2)
     */
    function func (a, b){}
    `)).examples,
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
  let func = await context.compileFunc(src1)
  delete func.source
  assert.deepEqual(func, {
    type: 'func',
    name: 'funcname',
    signature: 'funcname(par1: par1Type, par2: any): returnType',
    title: 'Function title',
    summary: 'Function summary',
    description: 'Function description',
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
  }, 'kitchensink example')

  // Overloading
  const src2 = `
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
  let funcs = await context.compileFunc(src2)
  assert.equal(funcs.length, 2)
  assert.deepEqual(funcs, [
    {
      type: 'func',
      name: 'funcname',
      signature: 'funcname(parA1: parA1Type): returnAType',
      description: 'Overload A description',
      params: [
        { name: 'parA1', type: 'parA1Type', description: 'Parameter A1 description' }
      ],
      return: { type: 'returnAType', description: 'Return A description' },
      source: { type: 'text', lang: 'js', data: '*\n     * Overload A description\n     *\n     * @param  {parA1Type} parA1 Parameter A1 description\n     * @return {returnAType} Return A description\n     ' }
    }, {
      type: 'func',
      name: 'funcname',
      signature: 'funcname(parB1: parB1Type): returnBType',
      description: 'Overload B description',
      params: [
        { name: 'parB1', type: 'parB1Type', description: 'Parameter B1 description' }
      ],
      return: { type: 'returnBType', description: 'Return B description' },
      source: { type: 'text', lang: 'js', data: '*\n     * Overload B description\n     *\n     * @param  {parB1Type} parB1 Parameter B1 description\n     * @return {returnBType} Return B description\n     ' }
    }
  ])

  assert.end()
})

test('JavascriptContext.executeFunc', async assert => {
  let context = new JavascriptContext()

  await context.executeFunc(function afunc () {})
  const got = await context.executeGet({name: 'afunc'})
  assert.deepEqual(
    {type: got.type, name: got.name},
    {type: 'func', name: 'afunc'}
  )

  assert.end()
})

test('JavascriptContext.executeCall', async assert => {
  let context = new JavascriptContext()

  async function testCall (call, expect, message) {
    let result = await context.executeCall(call)
    assert.deepEqual(result.value, expect, message)
  }

  async function testCallThrows (call, expect, message) {
    try {
      await context.executeCall(call)
      assert.fail(message)
    } catch (error) {
      assert.equal(error.message, expect, message)
    }
  }

  function no_pars () { // eslint-disable-line camelcase
    return 'Hello!'
  }
  await context.executeFunc(no_pars)

  testCall(
    {
      type: 'call',
      func: {type: 'get', name: 'no_pars'}
    }, {
      type: 'string',
      data: 'Hello!'
    },
    'no_pars()'
  )

  testCallThrows(
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
  await context.executeFunc(one_par)

  testCallThrows(
    {
      type: 'call',
      func: {type: 'get', name: 'one_par'}
    },
    'Function parameter "par" must be supplied'
  )

  testCall(
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

  testCall(
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

  testCallThrows(
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

  testCallThrows(
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
  await context.executeFunc(three_pars)

  testCall(
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
  await context.executeFunc(default_par)

  testCall(
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

  testCall(
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
  await context.executeFunc(repeats_par)

  testCall(
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

  testCall(
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
  await context.executeFunc(extends_par)

  testCall(
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

  testCall(
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
