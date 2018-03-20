const test = require('tape')

const SqliteContext = require('../../lib/contexts/SqliteContext')

test('SqliteContext.compileExpr', async assert => {
  const context = new SqliteContext()
  let result
  let error

  // Tests of malformed `expr` node

  result = await context.compileExpr({foo: null})
  error = result.messages[0]
  assert.deepEqual(error.message, 'Expression must have a `source` property')

  result = await context.compileExpr({source: {lang: 'python'}})
  error = result.messages[0]
  assert.deepEqual(error.message, 'Expression `source.lang` property must be either "sql" or "sqlite"')

  // Tests of SQL syntax errors and non-expressions

  result = await context.compileExpr('')
  error = result.messages[0]
  assert.deepEqual(error.message, 'Expression could not be parsed')

  result = await context.compileExpr('An intentional syntax error')
  error = result.messages[0]
  assert.deepEqual(error.message, 'Syntax error found near WITH Clause (Statement)')
  assert.deepEqual(error.line, 0)
  assert.deepEqual(error.column, 0)

  result = await context.compileExpr('SELECT * FROM mytable WHERE')
  error = result.messages[0]
  assert.deepEqual(error.message, 'Syntax error found near Column Identifier (WHERE Clause)')
  assert.deepEqual(error.line, 0)
  assert.deepEqual(error.column, 27)

  result = await context.compileExpr('SELECT 42; SELECT 24;')
  error = result.messages[0]
  assert.deepEqual(error.message, 'Expression must be a single SELECT statement')

  result = await context.compileExpr('DROP TABLE mypreciousdata')
  error = result.messages[0]
  assert.deepEqual(error.message, 'Expression must be a single SELECT statement')

  result = await context.compileExpr('DELETE FROM mypreciousdata')
  error = result.messages[0]
  assert.deepEqual(error.message, 'Expression must be a single SELECT statement')

  // Tests of parsing expression for string interpolation inputs

  result = await context.compileExpr('SELECT * FROM data WHERE height > ${x} AND width < ${y}') // eslint-disable-line no-template-curly-in-string
  assert.equal(result.messages.length, 0)
  assert.deepEqual(result.inputs, ['x', 'y', 'data'])

  // Tests of parsing expression for table inputs

  result = await context.compileExpr('SELECT * FROM table1')
  assert.equal(result.messages.length, 0)
  assert.deepEqual(result.inputs, ['table1'])

  result = await context.compileExpr('SELECT * FROM table1 LEFT JOIN table2')
  assert.equal(result.messages.length, 0)
  assert.deepEqual(result.inputs, ['table1', 'table2'])

  assert.end()
})
