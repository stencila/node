const test = require('tape')

const SqliteContext = require('../../lib/contexts/SqliteContext')

test('SqliteContext.compileExpr', async assert => {
  const context = new SqliteContext()
  let expr
  let compiled
  let error

  // Test it be called with a `expr` node or a string of SQL
  // and returns a compiled `expr` node

  expr = {
    type: 'expr',
    source: {
      type: 'text',
      lang: 'sql',
      data: 'SELECT * FROM data'
    }
  }
  compiled = await context.compileExpr(expr)
  assert.deepEqual(compiled.type, expr.type)
  assert.deepEqual(compiled.source, expr.source)
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, ['data'])

  let compiledFromString = await context.compileExpr('SELECT * FROM data')
  assert.deepEqual(compiled, compiledFromString)

  // Tests of malformed `expr` node

  compiled = await context.compileExpr({foo: null})
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression must have a `source` property')

  compiled = await context.compileExpr({source: {lang: 'python'}})
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression `source.lang` property must be either "sql" or "sqlite"')

  // Tests of SQL syntax errors and non-expressions

  compiled = await context.compileExpr('')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression could not be parsed')

  compiled = await context.compileExpr('An intentional syntax error')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Syntax error found near WITH Clause (Statement)')
  assert.deepEqual(error.line, 0)
  assert.deepEqual(error.column, 0)

  compiled = await context.compileExpr('SELECT * FROM mytable WHERE')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Syntax error found near Column Identifier (WHERE Clause)')
  assert.deepEqual(error.line, 0)
  assert.deepEqual(error.column, 27)

  compiled = await context.compileExpr('SELECT 42; SELECT 24;')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression must be a single "SELECT" statement')

  compiled = await context.compileExpr('DROP TABLE mypreciousdata')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression must be a "SELECT" statement, "DROP" not allowed')

  compiled = await context.compileExpr('DELETE FROM mypreciousdata')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression must be a "SELECT" statement, "DELETE" not allowed')

  // Tests of parsing expression for string interpolation inputs

  compiled = await context.compileExpr('SELECT * FROM data WHERE height > ${x} AND width < ${y}') // eslint-disable-line no-template-curly-in-string
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, ['data', 'x', 'y'])

  // Tests of parsing expression for table inputs

  compiled = await context.compileExpr('SELECT * FROM table1')
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, ['table1'])

  compiled = await context.compileExpr('SELECT * FROM table1 LEFT JOIN table2')
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, ['table1', 'table2'])

  // Test that any existing tables in the database are not
  // considered expression inputs
  context._db.run('CREATE TABLE existing1 (col1 TEXT)')
  context._db.run('CREATE TABLE existing2 (col2 REAL)')

  compiled = await context.compileExpr('SELECT * FROM input1 RIGHT JOIN existing1')
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, ['input1'])

  compiled = await context.compileExpr('SELECT * FROM existing2, existing1')
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, [])

  assert.end()
})

test('SqliteContext.compileBlock', async assert => {
  const context = new SqliteContext()
  let block
  let compiled

  // Test it be called with a `block` node or a string of SQL
  // and returns a compiled `block` node

  block = {
    type: 'block',
    source: {
      type: 'text',
      lang: 'sql',
      data: 'out = SELECT * FROM inp'
    }
  }
  compiled = await context.compileBlock(block)
  assert.deepEqual(compiled.type, block.type)
  assert.deepEqual(compiled.source, block.source)
  assert.deepEqual(compiled.inputs, ['inp'])
  assert.deepEqual(compiled.output, 'out')
  assert.deepEqual(compiled.messages, [])

  let compiledFromString = await context.compileBlock('out = SELECT * FROM inp')
  assert.deepEqual(compiled, compiledFromString)

  // Test that it errors with malformed output extension syntax
  compiled = await context.compileBlock('out = DELETE FROM foo')
  assert.deepEqual(compiled.messages, [{
    type: 'error',
    message: 'Syntax error found near WITH Clause (Statement)',
    line: 0,
    column: 0
  }])

  // Test that it errors if more than one output
  compiled = await context.compileBlock('out1 = SELECT 42;\nout2 = SELECT 42')
  assert.deepEqual(compiled.messages, [{
    type: 'error',
    message: 'Block must have only one output but 2 found "out1, out2"'
  }])

  // Test that it warns of potential side-effects
  compiled = await context.compileBlock('CREATE TABLE foo (bar INT); DROP TABLE foo')
  assert.deepEqual(compiled.messages, [{
    type: 'warning',
    message: 'Block has potential side effects caused by using "CREATE, DROP" statements'
  }])

  // Test that it returns inputs properly
  context._db.run('CREATE TABLE existing1 (col1 TEXT)')

  compiled = await context.compileExpr('SELECT * FROM input1 RIGHT JOIN existing1 WHERE existing1.col1 < ${input2}') // eslint-disable-line no-template-curly-in-string
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, ['input1', 'input2'])

  assert.end()
})
