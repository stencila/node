const assert = require('assert')
const sqlite3 = require('sqlite3').verbose()
const sqliteParser = require('sqlite-parser')
const util = require('util')

const Context = require('./Context')

class SqliteContext extends Context {
  constructor () {
    super()

    let db = ':memory:'
    this._db = new sqlite3.Database(db)
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
      let messages = []

      // Get interpolation inputs and interpolated SQL
      let interp = this._interpolateSql(sql)
      inputs = inputs.concat(interp.variables)

      // Check that the expression is a single, SELECT statement
      const ast = this._parseSql(interp.sql)
      assert(ast.statement.length === 1, 'Expression must be a single "SELECT" statement')
      assert(ast.statement[0].variant === 'select', `Expression must be a "SELECT" statement, "${ast.statement[0].variant.toUpperCase()}" not allowed`)

      // Get table inputs
      return this._tableInputs(ast).then(tables => {
        inputs = inputs.concat(tables)
        inputs.sort()

        return Object.assign(node, {
          messages,
          inputs
        })
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
      sql = sql.replace(/^(\s*(\w+)\s*=\s*)\b(SELECT\b.+)/g, function (match, group1, group2, group3) {
        outputs.push({
          name: group2,
          expr: group3
        })
        // Insert spaces so that error reporting location is correct
        return ' '.repeat(group1.length) + group3
      })
      if (outputs.length === 1) {
        output = outputs[0].name
      } else if (outputs.length > 1) {
        throw new Error(`Block must have only one output but ${outputs.length} found "${outputs.join(',')}"`)
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
      return this._tableInputs(ast).then(tables => {
        inputs = inputs.concat(tables)
        inputs.sort()

        return Object.assign(node, {
          messages,
          output,
          inputs
        })
      })
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
    return util.promisify(this._db.all).call(this._db, 'SELECT name FROM sqlite_master WHERE type=="table"').then(rows => {
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
    })
  }

  // Handle an error when compiling or executing a node
  // including dealing with error locations
  _handleError (error, node) {
    let line
    let column
    if (error.location) {
      line = error.location.start.line - 1
      column = error.location.start.column - 1
    }
    return Object.assign(node, {
      messages: [{
        type: 'error',
        message: error.message,
        line,
        column
      }]
    })
  }
}

SqliteContext.spec = {
  name: 'SqliteContext',
  client: 'ContextHttpClient'
}

module.exports = SqliteContext
