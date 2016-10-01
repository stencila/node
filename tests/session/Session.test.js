var test = require('tape');

var Session = require('../../src/session/Session');


test('Session can be constructed', function (t) {
  var c = new Session();

  t.ok(c instanceof Session);
  t.end();
});
