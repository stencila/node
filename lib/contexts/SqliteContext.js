const assert = require('assert')
const sqlite3 = require('sqlite3').verbose()
const sqliteParser = require('sqlite-parser')

const Context = require('./Context')

class SqliteContext extends Context {
  constructor () {
    super()

    let db = ':memory:'
    this._db = new sqlite3.Database(db)
  }

  compileExpr (node) {
    return Promise.resolve().then(() => {
      let sql
      if (typeof node === 'string' || node instanceof String) {
        sql = node
      } else {
        assert(node.source, 'Expression must have a `source` property')
        if (node.source.lang) assert.ok(node.source.lang.match(`^sql|sqlite$`), 'Expression `source.lang` property must be either "sql" or "sqlite"')
        sql = node.source.data
      }

      let inputs = []
      let messages = []

      // Get all variable interpolation inputs and replace them prior to parsing e.g. `${x}` by `0`
      sql = sql.replace(/\${([^{}]*)}/g, function (match, group1) {
        inputs.push(group1)
        return '0'
      })

      // Check that the expression is a single, SELECT statement
      const ast = sqliteParser(sql)
      assert(ast, 'Expression could not be parsed')
      assert(ast.statement.length === 1 && ast.statement[0].variant === 'select', 'Expression must be a single SELECT statement')

      // Get table inputs by filtering the AST
      const search = (object) => {
        if (object.type === 'identifier' && object.variant === 'table') {
          inputs.push(object.name)
        } else if (typeof object === 'object') {
          for (const property of Object.values(object)) {
            search(property)
          }
        }
      }
      search(ast.statement[0])

      return { messages, inputs }
    }).catch((error) => {
      let line
      let column
      if (error.location) {
        line = error.location.start.line - 1
        column = error.location.start.column - 1
      }
      return {
        messages: [{
          type: 'error',
          message: error.message,
          line,
          column
        }]
      }
    })
  }
}

SqliteContext.spec = {
  name: 'SqliteContext',
  client: 'ContextHttpClient'
}

module.exports = SqliteContext
