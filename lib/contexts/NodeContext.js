const fs = require('fs')
let glob = require('glob')
const path = require('path')
const rollup = require('rollup')
const rollupUglify = require('rollup-plugin-uglify')
const tmp = require('tmp')
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
   * a library specification object (exported as `LIBRARY`).
   *
   * @param {String} folder Path to library folder
   * @param {String} name Name of library (defaults to the folder name)
   * @param {Boolean} minify Should the bundle be minified? (defaults to true)
   */
  async compileLibrary (folder, name = null, minify = true) {
    let funcs = {}
    let index = ''
    let files = await glob(path.join(folder, 'funcs', '*.js'), {ignore: '**/_*'})
    for (let file of files) {
      let func = await this.compileFuncFile(file)
      delete func.source
      funcs[func.name] = func
      index += `export { default as ${func.name} } from '${file}'\n`
    }
    index += `export const LIBRARY = ${JSON.stringify(funcs, null, '  ')}\n`

    const indexPath = tmp.tmpNameSync()
    fs.writeFileSync(indexPath, index)

    const plugins = []
    if (minify) plugins.push(rollupUglify())
    const bundle = await rollup.rollup({
      input: indexPath,
      plugins: plugins
    })

    let bundleName = name || path.basename(folder)
    if (minify) bundleName += '.min'
    bundleName += '.js'
    let bundlePath = path.join(folder, bundleName)
    await bundle.write({
      format: 'umd',
      name: 'local',
      file: bundlePath
    })

    return bundlePath
  }

  async executeLibrary (folder, name) {
    const bundle = await this.compileLibrary(folder, name)
    const lib = require(bundle)
    this._libraries[name] = lib
  }
}

NodeContext.spec = {
  name: 'NodeContext',
  client: 'ContextHttpClient'
}

module.exports = NodeContext
