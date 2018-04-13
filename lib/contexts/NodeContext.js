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
   * Compile a Javascript function from a source code file
   *
   * @param  {String} file File path
   * @return {Object}      Function object
   */
  async compileFuncFile (file) {
    let content = fs.readFileSync(file, 'utf8')
    try {
      return this.compileFunc(content)
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
   * @param {String} folder Path to library folder
   * @param {String} name Name of library (defaults to the folder name)
   * @param {Boolean} minify Should the bundle be minified? (defaults to true)
   */
  async compileLibrary (folder, name = null, minify = true) {
    folder = untildify(folder)
    name = name || path.basename(folder)

    try {
      fs.statSync(folder)
    } catch (error) {
      throw new Error(`No such folder "${folder}"`)
    }

    const pattern = path.join(folder, 'funcs', '*.js')
    const files = await glob(pattern, {ignore: '**/_*'})
    if (files.length === 0) throw new Error(`No functions found matching pattern "${pattern}"`)

    let funcs = {}
    let index = ''
    for (let file of files) {
      let func = await this.compileFuncFile(file)
      delete func.source
      delete func.body
      funcs[func.name] = func
      index += `import ${func.name}_ from '${file}'\n`
      index += `export const ${func.name} = ${JSON.stringify(func, null, '  ')}\n`
      index += `${func.name}.body = ${func.name}_\n\n`
    }

    const indexPath = tmp.tmpNameSync()
    fs.writeFileSync(indexPath, index)

    const plugins = []
    if (minify) plugins.push(rollupUglify())
    const bundle = await rollup.rollup({
      input: indexPath,
      plugins: plugins
    })

    let bundleName = name
    if (minify) bundleName += '.min'
    bundleName += '.js'
    let bundlePath = path.join(folder, bundleName)
    await bundle.write({
      format: 'umd',
      name: 'local',
      file: bundlePath
    })

    return {
      type: 'library',
      name: name,
      funcs: funcs,
      bundle: bundlePath
    }
  }

  async executeLibrary (folder, name = null) {
    const library = await this.compileLibrary(folder, name)
    library.module = require(library.bundle)
    this._libraries[library.name] = library
    return {
      type: 'library',
      name: name,
      funcs: library.funcs
    }
  }
}

NodeContext.spec = {
  name: 'NodeContext',
  client: 'ContextHttpClient'
}

module.exports = NodeContext
