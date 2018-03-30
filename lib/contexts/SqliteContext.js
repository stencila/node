const assert = require('assert')
const crypto = require('crypto')
const Database = require('better-sqlite3')
const sqliteParser = require('sqlite-parser')
const uuid = require('uuid')

const Context = require('./Context')

class SqliteContext extends Context {
  constructor (...args) {
    super(...args)

    // Currently only supporting in-memory databases but in
    // future will allow loading from project folder
    const path = uuid()
    this._db = new Database(path, {memory: true})

    // Attached in-memory databases for caching of cell inputs and outputs
    this._db.exec('ATTACH DATABASE ":memory:" AS inputs')
    this._db.exec('ATTACH DATABASE ":memory:" AS outputs')
  }

  /**
   * Get a list of outputs available from this context
   */
  async outputs () {
    return this._db.prepare('SELECT name FROM outputs.sqlite_master WHERE type=="table" AND name NOT LIKE "tmp%"').pluck().all()
  }

  /**
   * Resolve an output value
   *
   * @override
   */
  async resolve (what) {
    const name = what.name
    const rows = this._db.prepare(`SELECT count(*) FROM outputs.sqlite_master WHERE type=="table" AND name=="${name}"`).pluck().get()
    if (rows === 1) return {
      local: true,
      table: `outputs.${name}`
    }
  }

  /**
   * An override to provide the caller an output value
   * (in this context's case, a database table) as a
   * data package
   *
   * @override
   */
  async provide (what) {
    let sql = `SELECT * FROM outputs.${what.name}`
    if (what.limit) sql += ` LIMIT ${what.limit}`
    let rows = this._db.prepare(sql).all()

    let data = {}
    if (rows.length > 0) {
      let fields = Object.keys(rows[0])

      for (let field of fields) {
        data[field] = []
      }
      for (let row of rows) {
        for (let field of fields) {
          data[field].push(row[field])
        }
      }
    }

    return this.pack({type: 'table', data})
  }

  /**
   * Compile an execution node
   *
   * For a `expr` node, checks that the node consists of a single `SELECT` statement. That is, multiple `SELECT` statements,
   * or other types of SQL statements, e.g `UPDATE`, `DELETE`, are invalid.
   *
   * Parses SQL to determine the `inputs` property of the node including variable interpolations and tables
   * e.g. `SELECT * FROM data WHERE height > ${min_height}` creates the inputs `["min_height", "data"]`.
   * Note that if a table already exists in the database then it is not included in `inputs` since it does
   * not need to be provided by the execution engine
   *
   * For `block` nodes determines if there is an output
   * e.g `low_gravity_planets` in `low_gravity_planets = SELECT * FROM planets WHERE gravity <= 1`
   *
   * For a local `block`, checks for any statements that may cause side effects e.g `DELETE` or `CREATE TABLE` statements
   *
   * @override
   */
  async compile (node, type = 'block') {
    try {
      if (typeof node === 'string' || node instanceof String) {
        node = {
          source: {
            type: 'text',
            lang: 'sql',
            data: node
          }
        }
      }
      if (!node.type) node.type = type
      if (!node.source) node.source = {type: 'text', data: ''}
      if (!node.global) node.global = false
      if (!node.inputs) node.inputs = []
      if (!node.output) node.output = {}

      // Start with empty messages
      node.messages = []

      if (node.source.lang) {
        assert.ok(node.source.lang.match(`^sql|sqlite$`), 'Expression `source.lang` property must be either "sql" or "sqlite"')
      }

      let sql = node.source.data
      let outputName
      if (node.type === 'block') {
        let trans = this._transpileSql(sql)
        sql = trans.sql
        outputName = trans.output
      }
      let interp = this._interpolateSql(sql)
      sql = interp.sql

      const ast = this._parseSql(sql)

      if (node.type === 'expr') {
        // Check that the AST is a single, SELECT statement
        assert(ast.statement.length === 1, 'Expression must be a single "SELECT" statement')
        assert(ast.statement[0].variant === 'select', `Expression must be a "SELECT" statement, "${ast.statement[0].variant.toUpperCase()}" not allowed`)
      } else {
        // Check the AST for side effects
        if (!node.global) {
          const effects = []
          const search = (object) => {
            if (object.type === 'statement' && (object.variant !== 'list' && object.variant !== 'select')) {
              effects.push(object.variant.toUpperCase())
            } else if (typeof object === 'object') {
              for (const property of Object.values(object)) {
                search(property)
              }
            }
          }
          search(ast)
          assert(effects.length === 0, `Block has potential side effects caused by using "${effects.join(', ')}" statements`)
        }
      }

      const tables = this._tableInputs(ast)

      // Set the node's inputs and output
      let inputNames = interp.variables.concat(tables).sort()
      let inputs = []
      for (let name of inputNames) {
        let input = {name}
        for (let current of node.inputs) {
          if (current.name === name && current.value) {
            input.value = current.value
            break
          }
        }
        inputs.push(input)
      }
      node.inputs = inputs

      if (outputName) node.output.name = outputName

      return node
    } catch (error) {
      return this._appendError(node, error)
    }
  }

  /**
   * Execute a node
   *
   * @override
   */
  async execute (node, type = 'block') {
    try {
      node = await this.compile(node, type)

      // Unpack inputs in parrallel (some may be remote pointers) and reduce to an object
      let unpacked = await Promise.all(node.inputs.map(input => this._unpack(input)))
      let inputs = unpacked.reduce((result, input) => {
        result[input.name] = input.value
        return result
      }, {})

      let sql = node.source.data
      if (node.type === 'block') {
        sql = this._transpileSql(sql).sql
      }
      sql = this._interpolateSql(sql, inputs).sql

      // Create temporary views to input tables
      for (let [name, value] of Object.entries(inputs)) {
        if (value && value.table) {
          this._db.exec(`CREATE TEMPORARY VIEW ${name} AS SELECT * FROM ${value.table}`)
        }
      }

      let valueSql
      if (node.type === 'expr') {
        // Output value of expression is just the expression
        valueSql = sql
      } else {
        // Split SQL into statements and run each
        let statements = sql.trim().split(';').filter(stmt => stmt.length > 0)
        for (let statement of statements.slice(0, -1)) {
          let prepared = this._db.prepare(statement)
          // Ignore all select statements except for the last one
          if (prepared.returnsData) {
            node.messages.push({
              type: 'warning',
              message: 'Ignored a SELECT statement that is before the last statement'
            })
          } else {
            prepared.run()
          }
        }
        // Output value of block is last statement
        valueSql = statements[statements.length - 1]
      }

      node.output.value = await this._pack(node.output.name, valueSql, node)

      // Destroy views to input tables
      for (let [name, value] of Object.entries(inputs)) {
        if (value && value.table) {
          this._db.exec(`DROP VIEW IF EXISTS ${name}`)
        }
      }

      return node
    } catch (error) {
      return this._appendError(node, error)
    }
  }

  /**
   * Transpile SQL removing any `output = SELECT ...` extensions and
   * returning the output names
   */
  _transpileSql (sql) {
    let outputs = []
    sql = sql.replace(/^(\s*(\w+)\s*=\s*)\b(SELECT\b.+)/mg, function (match, group1, group2, group3) {
      outputs.push({
        name: group2,
        expr: group3
      })
      // Insert spaces so that error reporting location is correct
      return ' '.repeat(group1.length) + group3
    })
    let output = null
    if (outputs.length === 1) {
      output = outputs[0].name
    } else if (outputs.length > 1) {
      let names = outputs.map(output => output.name).join(', ')
      throw new Error(`Block must have only one output but ${outputs.length} found "${names}"`)
    }
    return {output, sql}
  }

  /**
   * Do string interpolation of variables in SQL code
   *
   * @param  {String} sql SQL code with interpolation marks e.g. `SELECT * FROM data WHERE height > ${x} AND width < ${y}`
   * @return {Object}     Interpolation variable names and interpolated e.g. `{variables:['x', 'y'], sql: 'SELECT * FROM data WHERE height > 10 AND width < 32'}`
   */
  _interpolateSql (sql, inputs = {}) {
    let variables = []
    sql = sql.replace(/\${([^{}]*)}/g, function (match, name) {
      variables.push(name)
      return inputs[name] || '0'
    })
    return {variables, sql}
  }

  /**
   * Parse SQL
   *
   * @param  {String} sql SQL string
   * @return {AST}     SQL AST
   */
  _parseSql (sql) {
    let ast = sqliteParser(sql)
    assert(ast, 'Expression could not be parsed')
    return ast
  }

  /**
   * Get table inputs by filtering the AST but exclude those tables that already exist in the database
   *
   * @param  {AST}    ast SQL AST
   * @return {Array}      A list of tables that are inputs into the SQL statement/s
   */
  _tableInputs (ast) {
    let rows = this._db.prepare('SELECT name FROM sqlite_master WHERE type=="table"').all()
    const existing = rows.map(row => row.name)

    const tables = []
    const search = (object) => {
      if (object.type === 'identifier' && object.variant === 'table') {
        if (existing.indexOf(object.name) < 0) tables.push(object.name)
      } else if (typeof object === 'object') {
        for (const property of Object.values(object)) {
          search(property)
        }
      }
    }
    search(ast.statement[0])

    return tables
  }

  /**
   * Unpack an input `{name, value}` object
   *
   * @param  {Object} input Input object
   * @return {Object}       Object with name and unpacked value `{name, value}`
   */
  async _unpack (input) {
    let {name, value: packed} = input
    if (!packed) return {name} // Input may have not been provided. Deal with better?
    if (packed.type === 'table') {
      let table
      if (packed.data) {
        table = packed.data
      } else {
        table = await this.unpackPointer(packed)
        if (table.local) {
          return {name, value: {table: table.name}}
        }
      }
      // Create a table for this input
      let data = table.data
      let cols = Object.keys(data)
      let rows = data[cols[0]].length
      this._db.exec(`DROP TABLE IF EXISTS inputs.${name}`)
      this._db.exec(`CREATE TABLE inputs.${name} (${cols.join(', ')})`)
      let statement = this._db.prepare(`INSERT INTO ${name} VALUES (${Array(cols.length).fill('?').join(',')})`)
      for (let row = 0; row < rows; row++) {
        let rowData = []
        for (let col of cols) rowData.push(data[col][row])
        statement.run(rowData)
      }
      return {name, value: {table: `inputs.${name}`}}
    } else {
      return {name, value: await this.unpack(packed)}
    }
  }

  async _pack (name, select, node) {
    if (!name) name = 'tmp' + crypto.randomBytes(12).toString('hex')

    this._db.exec(`DROP TABLE IF EXISTS outputs.${name}`)
    this._db.exec(`CREATE TABLE outputs.${name} AS ${select}`)

    const MAX_ROWS = 10
    let pkg = await this.provide({name, limit: MAX_ROWS})

    // Decide to create a package or a data pointer
    let rowNum = this._db.prepare(`SELECT count(*) FROM outputs.${name}`).pluck().get()
    if (rowNum <= MAX_ROWS) {
      return pkg
    } else {
      return this.packPointer({type: 'table', name, preview: pkg.data})
    }
  }

  /**
   * Handle an error when compiling or executing a node
   * including dealing with error locations
   */
  _appendError (node, error) {
    let message = {
      type: 'error',
      message: error.message,
      stack: error.stack
    }
    if (error.location) {
      message.line = error.location.start.line - 1
      message.column = error.location.start.column - 1
    }
    if (!node.messages) node.messages = []
    node.messages.push(message)
    return node
  }
}

SqliteContext.spec = {
  name: 'SqliteContext',
  client: 'ContextHttpClient'
}

module.exports = SqliteContext
