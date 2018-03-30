const test = require('tape')

const Host = require('../../lib/host/Host')
const SqliteContext = require('../../lib/contexts/SqliteContext')

test('SqliteContext.compile expression', async assert => {
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
  compiled = await context.compile(expr)
  assert.deepEqual(compiled.type, expr.type)
  assert.deepEqual(compiled.source, expr.source)
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, [{name: 'data'}])

  let compiledFromString = await context.compile('SELECT * FROM data', 'expr')
  assert.deepEqual(compiled, compiledFromString)

  // Tests of malformed `expr` node

  compiled = await context.compile({source: {lang: 'python'}})
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression `source.lang` property must be either "sql" or "sqlite"')

  // Tests of SQL syntax errors and non-expressions

  compiled = await context.compile('', 'expr')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression could not be parsed')

  compiled = await context.compile('An intentional syntax error', 'expr')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Syntax error found near WITH Clause (Statement)')
  assert.deepEqual(error.line, 0)
  assert.deepEqual(error.column, 0)

  compiled = await context.compile('SELECT * FROM mytable WHERE', 'expr')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Syntax error found near Column Identifier (WHERE Clause)')
  assert.deepEqual(error.line, 0)
  assert.deepEqual(error.column, 27)

  compiled = await context.compile('SELECT 42; SELECT 24;', 'expr')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression must be a single "SELECT" statement')

  compiled = await context.compile('DROP TABLE mypreciousdata', 'expr')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression must be a "SELECT" statement, "DROP" not allowed')

  compiled = await context.compile('DELETE FROM mypreciousdata', 'expr')
  error = compiled.messages[0]
  assert.deepEqual(error.message, 'Expression must be a "SELECT" statement, "DELETE" not allowed')

  // Tests of parsing expression for string interpolation inputs

  compiled = await context.compile('SELECT * FROM data WHERE height > ${x} AND width < ${y}', 'expr') // eslint-disable-line no-template-curly-in-string
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, [
    {name: 'data'},
    {name: 'x'},
    {name: 'y'}
  ])

  // Tests of parsing expression for table inputs

  compiled = await context.compile('SELECT * FROM table1')
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, [{name: 'table1'}])

  compiled = await context.compile('SELECT * FROM table1 LEFT JOIN table2')
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, [{name: 'table1'}, {name: 'table2'}])

  // Test that any existing tables in the database are not
  // considered expression inputs
  context._db.exec(`
    CREATE TABLE existing1 (col1 TEXT);
    CREATE TABLE existing2 (col2 REAL)
  `)

  compiled = await context.compile('SELECT * FROM input1 RIGHT JOIN existing1')
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, [{name: 'input1'}])

  compiled = await context.compile('SELECT * FROM existing2, existing1')
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, [])

  assert.end()
})

test('SqliteContext.compile block', async assert => {
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
  compiled = await context.compile(block, 'block')
  assert.deepEqual(compiled.type, block.type)
  assert.deepEqual(compiled.source, block.source)
  assert.deepEqual(compiled.inputs, [{name: 'inp'}])
  assert.deepEqual(compiled.output, {name: 'out'})
  assert.deepEqual(compiled.messages, [])

  let compiledFromString = await context.compile('out = SELECT * FROM inp', 'block')
  assert.deepEqual(compiled, compiledFromString)

  // Test that it errors with malformed output extension syntax
  compiled = await context.compile('out = DELETE FROM foo', 'block')
  assert.deepEqual(compiled.messages[0].message, 'Syntax error found near WITH Clause (Statement)')

  // Test that it errors if more than one output
  compiled = await context.compile('out1 = SELECT 42;\nout2 = SELECT 42', 'block')
  assert.deepEqual(compiled.messages[0].message, 'Block must have only one output but 2 found "out1, out2"')

  // Test that it warns of potential side-effects
  compiled = await context.compile('CREATE TABLE foo (bar INT); DROP TABLE foo', 'block')
  assert.deepEqual(compiled.messages, [{
    type: 'warning',
    message: 'Block has potential side effects caused by using "CREATE, DROP" statements'
  }])

  // Test that it returns inputs properly
  context._db.exec('CREATE TABLE existing1 (col1 TEXT)')

  compiled = await context.compile('SELECT * FROM input1 RIGHT JOIN existing1 WHERE existing1.col1 < ${input2}', 'block') // eslint-disable-line no-template-curly-in-string
  assert.deepEqual(compiled.messages, [])
  assert.deepEqual(compiled.inputs, [{name: 'input1'}, {name: 'input2'}])

  // Test various types of output name syntax
  compiled = await context.compile('out = SELECT * FROM inp', 'block')
  assert.deepEqual(compiled.output.name, 'out')

  compiled = await context.compile('\n  out = SELECT * FROM inp', 'block')
  assert.deepEqual(compiled.output.name, 'out')

  assert.end()
})

test('SqliteContext.execute expressions', async assert => {
  const context = new SqliteContext()
  let executed

  context._db.exec(SMALL_TABLE_SQL)
  context._db.exec(LARGE_TABLE_SQL)

  // Test using no inputs
  executed = await context.execute('SELECT 42 AS answer', 'expr')
  assert.deepEqual(executed.inputs, [])
  assert.deepEqual(executed.output, {
    value: await context.packPackage({
      type: 'table',
      data: {'answer': [42]}
    })
  })
  assert.deepEqual(executed.messages, [])

  // Test using an existing table
  executed = await context.execute('SELECT * FROM test_table_small', 'expr')
  assert.deepEqual(executed.inputs, [])
  assert.deepEqual(executed.output, {
    value: await context.packPackage({
      type: 'table',
      data: {
        col1: ['a', 'b', 'c'],
        col2: [1, 2, 3]
      }
    })
  })
  assert.deepEqual(executed.messages, [])

  // Test with an interpolated variable input
  executed = await context.execute({
    type: 'expr',
    source: {data: 'SELECT * FROM test_table_small WHERE col2 <= ${x}'}, // eslint-disable-line
    inputs: [{
      name: 'x',
      value: {type: 'number', data: 2}
    }],
    output: {},
    messages: []
  })
  assert.deepEqual(executed.output, {
    value: await context.packPackage({
      type: 'table',
      data: {
        col1: ['a', 'b'],
        col2: [1, 2]
      }
    })
  })
  assert.deepEqual(executed.messages, [])

  // Test with a table input
  executed = await context.execute({
    type: 'expr',
    source: {data: 'SELECT * FROM mydata WHERE col2 <= 2'},
    inputs: [{
      name: 'mydata',
      value: await context.packPackage({
        type: 'table',
        data: {
          col1: ['A', 'B', 'C', 'D'],
          col2: [1, 2, 3, 4]
        }
      })
    }],
    output: {},
    messages: []
  })
  assert.deepEqual(executed.output, {
    value: await context.packPackage({
      type: 'table',
      data: {
        col1: ['A', 'B'],
        col2: [1, 2]
      }
    })
  })
  assert.deepEqual(executed.messages, [])

  assert.end()
})

test('SqliteContext.execute blocks', async assert => {
  const context = new SqliteContext()
  let executed

  context._db.exec(SMALL_TABLE_SQL)
  context._db.exec(LARGE_TABLE_SQL)

  // Test with named output on last line
  executed = await context.execute({
    type: 'block',
    source: {
      data: `
        CREATE TABLE mytable (col1 TEXT, col2 INT);
        INSERT INTO mytable VALUES ('a', 1);
        INSERT INTO mytable VALUES ('b', 2);
        INSERT INTO mytable VALUES ('c', 3);

        x = SELECT * FROM mytable WHERE col2 <= \${x}
      `
    },
    inputs: [{
      name: 'x',
      value: {type: 'number', data: 2}
    }],
    messages: []
  })
  assert.deepEqual(executed.output, {
    name: 'x',
    value: await context.packPackage({
      type: 'table',
      data: {
        col1: ['a', 'b'],
        col2: [1, 2]
      }
    })
  })
  assert.equal(executed.messages.length, 1)
  assert.equal(executed.messages[0].type, 'warning')

  // Test with an interpolated variable input
  executed = await context.execute('SELECT * FROM test_table_small')
  assert.deepEqual(executed.output.value.data.data.col1.length, 3)
  assert.deepEqual(executed.messages, [])

  // Ignore all SELECT statements except for the last
  executed = await context.execute('SELECT * FROM test_table_large; SELECT * FROM test_table_small')
  assert.deepEqual(executed.output.value.data.data.col1.length, 3)
  assert.deepEqual(executed.messages, [ { type: 'warning', message: 'Ignored a SELECT statement that is before the last statement' } ])

  assert.end()
})

test('SqliteContext pointers', async assert => {
  const hostA = new Host()
  const hostB = new Host()
  await hostA.start()
  await hostB.start()

  const contextA1 = (await hostA.create('SqliteContext')).instance
  const contextA2 = (await hostA.create('SqliteContext')).instance
  const contextB1 = (await hostB.create('SqliteContext')).instance

  contextA1._db.exec(LARGE_TABLE_SQL)

  let pointer1 = (await contextA1.execute('SELECT * FROM test_table_large')).output.value
  assert.equal(pointer1.type, 'table')
  assert.ok(pointer1.path.value.id, 'should have an id which identifies value')
  assert.ok(pointer1.path.value.name, 'should have a name for getting this value from context')
  assert.equal(pointer1.type, 'table')

  let pointer2 = (await contextA1.execute('SELECT * FROM test_table_large')).output.value
  assert.notEqual(pointer1.path.value.id, pointer2.path.value.id, 'each pointer value has a unique id')

  let pointer3 = (await contextA1.execute('out = SELECT * FROM test_table_large')).output.value
  assert.equal(pointer3.path.value.name, 'out', 'when an output name is explicitly set then that is the name of pointer value')

  const data1 = await contextA1.unpackPointer(pointer1)
  assert.deepEqual(data1, true, 'unpacking the pointer with the same context resolves to true (i.e. no serialisation)')

  const data2 = await contextA2.unpackPointer(pointer1)
  const data3 = await contextB1.unpackPointer(pointer1)
  assert.deepEqual(data2, data3, 'unpacking the pointer in different contexts provides a serialised version')

  await hostA.stop()
  await hostB.stop()

  assert.end()
})

test('SqliteContext.variables', async assert => {
  const context = new SqliteContext()

  context._db.exec(SMALL_TABLE_SQL)

  assert.deepEqual(await context.variables(), [])

  await context.execute('a = SELECT 1')
  assert.deepEqual(await context.variables(), ['a'])

  await context.execute('SELECT 2')
  assert.deepEqual(await context.variables(), ['a'])

  await context.execute('b = SELECT 3')
  assert.deepEqual(await context.variables(), ['a', 'b'])

  assert.end()
})

// Some SQL to create test tables
const SMALL_TABLE_SQL = `
  CREATE TABLE test_table_small (col1 TEXT, col2 INT);
  INSERT INTO test_table_small VALUES ('a', 1);
  INSERT INTO test_table_small VALUES ('b', 2);
  INSERT INTO test_table_small VALUES ('c', 3);
`
const LARGE_TABLE_SQL = `
  CREATE TABLE test_table_large (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    col1 TEXT NOT NULL,
    col2 INT NOT NULL
  );
  INSERT INTO test_table_large (col1, col2)
  SELECT 'a', 42
  FROM (SELECT * FROM (
       (SELECT 0 UNION ALL SELECT 1) t2,
       (SELECT 0 UNION ALL SELECT 1) t4,
       (SELECT 0 UNION ALL SELECT 1) t8,
       (SELECT 0 UNION ALL SELECT 1) t16,
       (SELECT 0 UNION ALL SELECT 1) t32,
       (SELECT 0 UNION ALL SELECT 1) t64,
       (SELECT 0 UNION ALL SELECT 1) t128,
       (SELECT 0 UNION ALL SELECT 1) t256
       )
  );
`
