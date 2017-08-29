const Dat = require('dat-node')
const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const tmp = require('tmp')
const test = require('tape')

const DatStorer = require('../../src/backend/DatStorer')

test('DatStorer.readFile', t => {

  const content = 'a,b\n1,2\n3,4'

  // First set up folder to be shared and read in this test
  const folderShared = tmp.dirSync().name
  fs.writeFileSync(path.join(folderShared,'test.csv'), content)

  // Make it a Dat
  const home = tmp.dirSync().name
  Dat(folderShared, (err, datShared) => {
    t.error(err)
    
    // Delete any previous .dat folder
    rimraf.sync(path.join(folderShared, '.dat'))

    // Import the folder's files into the dat
    datShared.importFiles(err => {
      t.error(err)
      
      const hex = datShared.key.toString('hex')
      t.pass(`Folder ${folderShared} shared as dat://${hex}`)

      // Read data using DataStorer
      const dataStorer = new DatStorer(home, hex)
      dataStorer.readFile('/test.csv').then(data => {
        t.equal(data, content)
        // Close the shared data and end the test
        datShared.close(error => {
          t.error(error)
          t.end()
        })
      }).catch(error => {
        t.error(error)
        t.end()
      })
    })

    // Join the network to share this dat
    datShared.joinNetwork()
    datShared.network.on('connection', function () {
      t.pass('Shared dat is connected to network')
    })

  })

})
