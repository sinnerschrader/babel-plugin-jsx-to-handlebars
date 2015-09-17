import test from 'tape';
import {handlebars, react} from '../helpers';

test('hello world', (t) => {
  t.plan(1);
  let path = './tests/hello-world/hello-world.jsx';
  t.equal(handlebars(path), react(path));
});
