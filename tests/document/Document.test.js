var test = require('tape');

var Document = require('../../src/document/Document');


test('Document can be constructed', function (t) {
  var c = new Document();

  t.ok(c instanceof Document);
  t.end();
});
