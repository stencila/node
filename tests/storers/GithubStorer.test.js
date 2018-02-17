const fs = require('fs')
const path = require('path')
const test = require('tape')

const Host = require('../../src/host/Host')

const GithubStorer = require('../../src/storers/GithubStorer')
let s = new GithubStorer({path: 'stencila/test/README.md'})

test.skip('GithubStorer.getInfo', t => {  
  s.getInfo().then(info => {
    let dir = path.join(Host.userDir(),'stores/github/stencila/test/master')
    t.ok(fs.existsSync(dir))
    t.deepEqual(info, {
      dir: dir,
      main: 'README.md',
      files: [ '.travis.yml', 'README.md', 'document.md', 'sub' ]
    })
    t.end()
  })
})

test.skip('GithubStorer.readFile', t => {  
  s.readFile('document.md').then(content => {
    t.equal(content, 'Hello world')
    t.end()
  })
})

