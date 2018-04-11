const test = require('tape')

const JavascriptContext = require('../../lib/contexts/JavascriptContext')

test('JavascriptContext', assert => {
  const context = new JavascriptContext()

  assert.ok(context instanceof JavascriptContext)
  assert.end()
})

test('JavascriptContext.compileFunc', assert => {
  let context = new JavascriptContext()

  // Test that bad inputs are handled OK
  assert.throws(() => context.compileFunc(''), /No function definition found in the source code/, 'throws if no function defined')
  assert.throws(() => context.compileFunc('foo bar()'), /Syntax error in source code: Unexpected token \(1:4\)/, 'throws if syntax error')

  // Check parameters parsed from function declaration and doc comments
  function checkParams (source, expect, message) {
    assert.deepEqual(context.compileFunc(source).params, expect, message)
  }

  checkParams('function func (){}', [], 'no parameters')
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

  // Check return parsed from doc comment
  function checkReturn (source, expect, message) {
    assert.deepEqual(context.compileFunc(source)['return'], expect, message)
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

  // Kitchensink test
  assert.deepEqual(
    context.compileFunc('function square(value){return value*value}'),
    {
      type: 'func',
      source: {
        type: 'text',
        lang: 'js',
        data: 'function square(value){return value*value}'
      },
      name: 'square',
      params: [
        {
          name: 'value'
        }
      ]
    }
  )

  assert.end()
})
