var test = require('tape');

var Component = require('../src/Component');


test('Component can be constructed', function (t) {
  var c = new Component();

  t.ok(c instanceof Component);
  t.end();
});
