const fs = require('fs')
let glob = require('glob')
const path = require('path')
const rollup = require('rollup')
const rollupUglify = require('rollup-plugin-uglify')
const tmp = require('tmp')
const untildify = require('untildify')
const util = require('util')
glob = util.promisify(glob)

const JavascriptContext = require('./JavascriptContext')

/**
 * A Node.js context for executing Javascript code
 */
class NodeContext extends JavascriptContext {
  /**
   * Compile a Javascript source code file
   *
   * @param  {String} file File path
   * @return {Object}      Function object
   */
  async compileFile (file) {
    let content = fs.readFileSync(file, 'utf8')
    try {
      return this.compile(content)
    } catch (error) {
      throw new Error(`Error compiling file "${file}": ` + error.message)
    }
  }

  /**
   * Compile a Stencila library so that it can be loaded either into
   * a `NodeContext` or another `JavascriptContext` (e.g one embedded
   * into a Stencila web or desktop interface).
   *
   * Creates a Javascript bundle which exports both function definitions and
   * a function specification objects.
   *
   * @param {String} src Path to library folder
   * @param {String} dest Destination
   * @param {Boolean} minify Should the bundle be minified? (defaults to true)
   */
  async compileLibrary (library = {}) {
    let src = library.src || '.'
    let dest = library.dest
    let minify = (library.minify === false) ? library.minify : true

    src = path.resolve(untildify(src))
    if (!dest) {
      let file = path.basename(src)
      if (minify) file += '.min'
      file += '.js'
      dest = path.join(src, file)
    }

    try {
      fs.statSync(src)
    } catch (error) {
      throw new Error(`No such folder "${src}"`)
    }

    const name = library.name || path.basename(src)

    let json
    try {
      json = fs.readFileSync(path.join(src, 'package.json'))
    } catch (error) {
      json = '{}'
    }
    const pkg = JSON.parse(json)

    const pattern = path.join(src, 'funcs', '*.js')
    const files = await glob(pattern, {ignore: '**/_*'})
    if (files.length === 0) throw new Error(`No functions found matching pattern "${pattern}"`)

    let funcs = {}
    let index = `
      export const type = 'library'
      export const name = '${name}'
      export let funcs = {}
    `
    for (let file of files) {
      let cell
      try {
        cell = await this.compileFile(file, false)
      } catch (error) {
        throw new Error(`Error compiling file "${file}": ${error.message}`)
      }
      let func = cell.outputs[0].value
      const name = func.name
      funcs[name] = func

      const json = JSON.stringify(func, null, '  ')
      index += `import ${name}_ from '${file}'\n`
      index += `funcs['${name}'] = ${json}\n`
      index += `funcs['${name}'].body = ${name}_\n\n`
    }

    const indexPath = tmp.tmpNameSync()
    fs.writeFileSync(indexPath, index)

    const rollupConfig = pkg.rollup || {}

    const plugins = []
    if (minify) plugins.push(rollupUglify())

    const bundle = await rollup.rollup({
      input: indexPath,
      plugins: plugins,
      external: rollupConfig.external
    })

    await bundle.write({
      format: 'umd',
      name: rollupConfig.name || 'local',
      file: dest,
      globals: rollupConfig.globals
    })

    return {
      type: 'library',
      name: name,
      funcs: funcs,
      bundle: dest
    }
  }

  async executeLibrary (library_) {
    const library = await this.compileLibrary(library_)
    library.module = require(library.bundle)
    this._libraries[library.name] = library
    return {
      type: 'library',
      name: library.name,
      funcs: library.funcs
    }
  }
}

NodeContext.spec = {
  name: 'NodeContext',
  client: 'ContextHttpClient'
}

module.exports = NodeContext
