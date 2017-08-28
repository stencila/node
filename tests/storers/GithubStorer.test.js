const fs = require('fs')
const path = require('path')
const test = require('tape')

const host = require('../../src/host/singletonHost')

const GithubStorer = require('../../src/storers/GithubStorer')
let s = new GithubStorer({path: 'stencila/test/README.md'})

test('GithubStorer.getInfo', t => {  
  s.getInfo().then(info => {
    let dir = path.join(host.userDir(),'stores/github/stencila/test/master')
    t.ok(fs.existsSync(dir))
    t.deepEqual(info, {
      dir: dir,
      main: 'README.md',
      files: [ '.travis.yml', 'README.md', 'document.md', 'sub' ]
    })
    t.end()
  })
})

test('GithubStorer.readFile', t => {  
  s.readFile('document.md').then(content => {
    t.equal(content, 'Hello world')
    t.end()
  })
})

