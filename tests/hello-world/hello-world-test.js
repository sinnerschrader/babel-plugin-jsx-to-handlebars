var test = require('tape');
var helpers = require('../helpers');

test('hello world', function(t) {
  t.plan(1);
  t.equal(helpers('./tests/hello-world/hello-world.jsx')(), '<div>Hello world!</div>')
});
