const assert = require('assert')
const Database = require('better-sqlite3')
const sqliteParser = require('sqlite-parser')
const uuid = require('uuid')

const Context = require('./Context')

class SqliteContext extends Context {
  constructor () {
    super()

    const path = uuid()
    this._db = new Database(path, {memory: true})
  }

  /**
   * Compile an `expr` node
   *
   * Checks that the node consists of a single `SELECT` statement. That is, multiple `SELECT` statements,
   * or other types of SQL statements, e.g `UPDATE`, `DELETE`, are invalid.
   *
   * Parses SQL to determine the `inputs` property of the node including variable interpolations and tables
   * e.g. `SELECT * FROM data WHERE height > ${min_height}` creates the inputs `["min_height", "data"]`.
   * Note that if a table already exists in the database then it is not included in `inputs` since it does
   * not need to be provided by the execution engine
   *
   * @override
   */
  compileExpr (node) {
    return Promise.resolve().then(() => {
      if (typeof node === 'string' || node instanceof String) {
        node = {
          type: 'expr',
          source: {
            type: 'text',
            lang: 'sql',
            data: node
          }
        }
      } else {
        assert(node.source, 'Expression must have a `source` property')
        if (node.source.lang) assert.ok(node.source.lang.match(`^sql|sqlite$`), 'Expression `source.lang` property must be either "sql" or "sqlite"')
      }

      let sql = node.source.data
      let inputs = []
      let output = null
      let messages = []

      // Get interpolation inputs and interpolated SQL
      let interp = this._interpolateSql(sql)
      inputs = inputs.concat(interp.variables)

      // Check that the expression is a single, SELECT statement
      const ast = this._parseSql(interp.sql)
      assert(ast.statement.length === 1, 'Expression must be a single "SELECT" statement')
      assert(ast.statement[0].variant === 'select', `Expression must be a "SELECT" statement, "${ast.statement[0].variant.toUpperCase()}" not allowed`)

      // Get table inputs
      const tables = this._tableInputs(ast)
      inputs = inputs.concat(tables).sort().map(name => {
        return {name}
      })

      return Object.assign(node, {
        inputs,
        output,
        messages
      })
    }).catch((error) => {
      return this._handleError(error, node)
    })
  }

  /**
   * Compile a `block` node
   *
   * Parses the block of SQL code for:
   *
   * - an output, e.g `low_gravity_planets` in `low_gravity_planets = SELECT * FROM planets WHERE gravity <= 1`
   * - then checks that the output's expression is valid using `compileExpr`
   * - checks for any statements that may cause side effects e.g `DELETE` or `CREATE TABLE` statements
   *
   * @override
   */
  compileBlock (node) {
    return Promise.resolve().then(() => {
      if (typeof node === 'string' || node instanceof String) {
        node = {
          type: 'block',
          source: {
            type: 'text',
            lang: 'sql',
            data: node
          }
        }
      } else {
        assert(node.source, 'Expression must have a `source` property')
        if (node.source.lang) assert.ok(node.source.lang.match(`^sql|sqlite$`), 'Expression `source.lang` property must be either "sql" or "sqlite"')
      }

      let sql = node.source.data

      let inputs = []
      let output = null
      let messages = []

      // Determine block output, if any
      let outputs = []
      sql = sql.replace(/^(\s*(\w+)\s*=\s*)\b(SELECT\b.+)/mg, function (match, group1, group2, group3) {
        outputs.push({
          name: group2,
          expr: group3
        })
        // Insert spaces so that error reporting location is correct
        return ' '.repeat(group1.length) + group3
      })
      if (outputs.length === 1) {
        output = {name: outputs[0].name}
      } else if (outputs.length > 1) {
        let names = outputs.map(output => output.name).join(', ')
        throw new Error(`Block must have only one output but ${outputs.length} found "${names}"`)
      }

      // Get interpolation inputs and interpolated SQL
      let interp = this._interpolateSql(sql)
      inputs = inputs.concat(interp.variables)

      // Parse the intepolated SQL
      const ast = this._parseSql(interp.sql)

      // Check the block for side effects
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
      if (effects.length) {
        messages.push({
          type: 'warning',
          message: `Block has potential side effects caused by using "${effects.join(', ')}" statements`
        })
      }

      // Get table inputs
      const tables = this._tableInputs(ast)
      inputs = inputs.concat(tables).sort().map(name => {
        return {name}
      })

      return Object.assign(node, {
        inputs,
        output,
        messages
      })
    }).catch((error) => {
      return this._handleError(error, node)
    })
  }

  /**
   * Execute an `expr` node
   *
   * @override
   */
  executeExpr (node) {
    return Promise.resolve().then(() => {
      // If necessary compile the node
      if (typeof node === 'string' || node instanceof String || !node.inputs) {
        return this.compileExpr(node).then((compiled) => {
          return this.executeExpr(compiled)
        })
      }
      // Unpack inputs
      let inputs = {}
      for (let input of node.inputs) {
        let {name, value} = this._unpackInput(input)
        inputs[name] = value
      }
      // Do variable interpolation
      let sql = node.source.data
      let interp = this._interpolateSql(sql, inputs)
      // Execute SQL
      const rows = this._db.prepare(interp.sql).all()
      // Create a data frame from the rows
      node.output = {value: this._packTable(rows)}
      return node
    }).catch((error) => {
      return this._handleError(error, node)
    })
  }

  /**
   * Do string interpolation of variable in SQL code
   *
   * @param  {String} sql SQL code with interpolation marks e.g. `SELECT * FROM data WHERE height > ${x} AND width < ${y}`
   * @return {Object}     Interpolation variable names and interpolated e.g. `{variables:['x', 'y'], sql: 'SELECT * FROM data WHERE height > 10 AND width < 32'}`
   */
  _interpolateSql (sql, values = {}) {
    let variables = []
    sql = sql.replace(/\${([^{}]*)}/g, function (match, variable) {
      variables.push(variable)
      return values[variable] || '0'
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
   * Upack an input `{name, value}` object
   *
   * @param  {Object} input Input object
   * @return {Object}       Object with namne and unpacked value `{name, value}`
   */
  _unpackInput (input) {
    let {name, value} = input
    if (value.type === 'table') {
      // Create a temporary SQL table for input tables
      let cols = Object.keys(value.data)
      let rows = value.data[cols[0]].length
      this._db.exec(`DROP TABLE IF EXISTS ${name}`)
      this._db.exec(`CREATE TEMPORARY TABLE ${name} (${cols.join(', ')})`)
      let statement = this._db.prepare(`INSERT INTO ${name} VALUES (${Array(cols.length).fill('?').join(',')})`)
      for (let row = 0; row < rows; row++) {
        let rowData = []
        for (let col of cols) rowData.push(value.data[col][row])
        statement.run(rowData)
      }
      return {name, value: ''}
    } else {
      return {name, value: this.unpack(value)}
    }
  }

  /**
   * Pack a database table into a data table node
   *
   * @param  {Array} rows  Array of objects resulting from a database query
   * @return {Object}      A data table (either a data package, or a data pointer)
   */
  _packTable (rows) {
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

    return {
      type: 'table',
      data: data
    }
  }

  // Handle an error when compiling or executing a node
  // including dealing with error locations
  _handleError (error, node) {
    let message = {
      type: 'error',
      message: error.message
    }
    if (error.location) {
      message.line = error.location.start.line - 1
      message.column = error.location.start.column - 1
    }
    return Object.assign(node, {
      messages: [message]
    })
  }
}

SqliteContext.spec = {
  name: 'SqliteContext',
  client: 'ContextHttpClient'
}

module.exports = SqliteContext
