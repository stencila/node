#!/usr/bin/env node
const fse = require('fs-extra')
const path = require('path')

const stencila = path.dirname(require.resolve('stencila/package.json'))
const src = path.join(stencila, 'build')
const dest = 'static/stencila'

fse.ensureDirSync('static')
fse.removeSync(dest)
fse.copySync(src, dest)
