const fs = require('fs')
const path = require('path')
const testPromise = require('../helpers.js').testPromise

const Host = require('../../src/host/Host')

const GithubStorer = require('../../src/storers/GithubStorer')
let s = new GithubStorer('stencila/test@master')

testPromise('GithubStorer.readdir', t => {  
  return s.readdir('.').then(entries => {
    let dir = path.join(Host.userDir(),'stores/github/stencila/test/master')
    t.ok(fs.existsSync(dir))
    t.deepEqual(entries, [ '.travis.yml', 'README.md', 'document.md', 'sub' ])
    t.end()
  })
})

testPromise('GithubStorer.readFile', t => {  
  return s.readFile('document.md').then(content => {
    t.equal(content, 'Hello world')
    t.end()
  })
})

