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
  } catch (error) {
    assert.ok(error.message.match(/^Syntax error in source code: Unexpected token \(1:4\)/), 'throws if syntax error')
  }

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
  assert.deepEqual(await context.compileFunc(src), {
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
