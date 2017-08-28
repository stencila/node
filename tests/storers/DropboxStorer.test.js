const fs = require('fs')
const path = require('path')
const test = require('tape')

const host = require('../../src/host/singletonHost')

const DropboxStorer = require('../../src/storers/DropboxStorer')
let s = new DropboxStorer({path: 'el77xzcpr9uqxb1/AABJIkDNXo_-sKnrUtQvCxC4a'})

test('DropboxStorer.getInfo', t => {  
  s.getInfo().then(info => {
    let dir = path.join(host.userDir(),'stores/dropbox/el77xzcpr9uqxb1/AABJIkDNXo_-sKnrUtQvCxC4a')
    t.ok(fs.existsSync(dir))
    t.deepEqual(info, {
      dir: dir,
      main: null,
      files: [ 'main.md', 'my-data.csv' ]
    })
    t.end()
  })
})

