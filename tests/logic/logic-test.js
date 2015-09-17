import test from 'tape';
import {handlebars, react} from '../helpers';

test('guard expressions in jsx must be respected', (t) => {
  t.plan(1);
  let path = './tests/logic/guard.jsx';
  t.equal(handlebars(path), react(path));
});
