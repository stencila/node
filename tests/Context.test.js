var test = require('tape');

var Context = require('../src/Context');


test('Context can be constructed', function (t) {
  var c = new Context();

  t.ok(c instanceof Context);
  t.end();
});
