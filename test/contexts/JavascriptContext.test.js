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
      source: { type: 'text', lang: 'js', data: 'function afunc() {}' },
      body: afunc
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
     * @param {number} pars Description of parameters
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
  const src = `
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
     * @param  {*} par2 Parameter two description
     * @return {returnType} Return description
     */
    function funcname(par1, ...par2){
      return par1 + sum(par2)
    }
  `
  let func = await context.compileFunc(src)
  delete func.body
  assert.deepEqual(func, {
    type: 'func',
    source: {
      type: 'text',
      lang: 'js',
      data: src
    },
    name: 'funcname',
    title: 'Function title',
    summary: 'Function summary',
    description: 'Function description',
    examples: [
      {
        usage: 'funcname(1, 2, 3, 4)',
        caption: 'Example caption'
      }, {
        usage: 'funcname(x, y, z)'
      }
    ],
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
    }
  })

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

  // Functions that we are going to call...

  function no_pars () { // eslint-disable-line camelcase
    return 'Hello!'
  }
  await context.executeFunc(no_pars)

  function one_par (a) { // eslint-disable-line camelcase
    return a
  }
  await context.executeFunc(one_par)

  function three_pars (foo, bar, baz) { // eslint-disable-line camelcase
    return {foo, bar, baz}
  }
  await context.executeFunc(three_pars)

  function default_par (foo, bar = 'beep') { // eslint-disable-line camelcase
    return bar
  }
  await context.executeFunc(default_par)

  function repeats_par (arg1, ...args) { // eslint-disable-line camelcase
    return `${arg1} ${args.join(',')}`
  }
  await context.executeFunc(repeats_par)

  function extends_par (arg1, ___args) { // eslint-disable-line camelcase
    return `${arg1} ${___args ? Object.entries(___args).join(' ') : ''}`
  }
  await context.executeFunc(extends_par)

  // Now test calling those funcs...

  assert.deepEqual(await context.executeCall({
    type: 'call',
    func: {type: 'get', name: 'no_pars'}
  }), {
    type: 'string',
    data: 'Hello!'
  })

  /*
  assert.throws(
    await () => context.executeCall({type: 'call', func: one_par}),
    /Function parameter "a" must be supplied/,
    'one_par()'
  )
  assert.equal(
    await context.executeCall({type: 'call', func: one_par, args: [1]}),
    1,
    'one_par(1)'
  )
  assert.equal(
    await context.executeCall({type: 'call', func: one_par, namedArgs: {a: 1}}),
    1,
    'one_par(a=1)'
  )
  assert.throws(
    await () => context.executeCall({type: 'call', func: one_par, args: [2], namedArgs: {a: 1}}),
    /Function was supplied 1 extra arguments/,
    'one_par(2, a=1)'
  )
  assert.throws(
    await () => context.executeCall({type: 'call', func: one_par, namedArgs: {a: 1, b: 2, c: 3}}),
    /Function was supplied extra named arguments "b", "c"/,
    'one_par(a=1, b=2, c=3)'
  )
  assert.deepEqual(one_par.pars, [{name: 'a'}])

  await context.executeCall({type: 'call', func: three_pars, namedArgs: {foo: 1, bar: 2, baz: 3}})
  assert.deepEqual(three_pars.pars, [{name: 'foo'}, {name: 'bar'}, {name: 'baz'}])

  assert.equal(
    await context.executeCall({type: 'call', func: default_par, namedArgs: {foo: 1, bar: "bop"}}),
    'bop',
    'default_par(1, "bop")'
  )
  assert.equal(
    await context.executeCall({type: 'call', func: default_par, args: [1]}),
    'beep',
    'default_par(1)'
  )
  assert.deepEqual(
    default_par.pars,
    [{name: 'foo'}, {name: 'bar', default: true}],
    'default_par.pars'
  )

  assert.equal(
    await context.executeCall({type: 'call', func: repeats_par, args: ["bar", "baz", "boop"]}),
    'bar baz,boop',
    'repeats_par("bar", "baz", "boop")'
  )
  assert.equal(
    await context.executeCall({type: 'call', func: repeats_par, args: ["bar"]}),
    'bar ',
    'repeats_par("bar")'
  )
  assert.deepEqual(repeats_par.pars, [{name: 'arg1'}, {name: 'args', repeats: true}])

  assert.equal(
    await context.executeCall({type: 'call', func: named_repeats_par, args: [1]}),
    '1 ',
    'named_repeats_par(1)'
  )
  assert.equal(
    await context.executeCall({type: 'call', func: named_repeats_par, args: [1], namedArgs: {a:1, b:2, c:3}}),
    '1 a,1 b,2 c,3',
    'named_repeats_par(1, a=1, b=2, c=3)'
  )
  assert.deepEqual(
    named_repeats_par.pars,
    [{name: 'arg1'}, {name: 'args', namedRepeats: true}],
    'named_repeats_par.pars'
  )
  */

  assert.end()
})
