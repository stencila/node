var test = require('tape');

var Sheet = require('../src/Sheet');


test('Sheet can be constructed', function (t) {
  var c = new Sheet();

  t.ok(c instanceof Sheet);
  t.end();
});
