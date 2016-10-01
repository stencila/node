var test = require('tape');

var Document = require('../src/Document');


test('Document can be constructed', function (t) {
  var c = new Document();

  t.ok(c instanceof Document);
  t.end();
});
