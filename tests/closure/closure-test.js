import test from 'tape';
import {handlebars, react} from '../helpers';

test('closures should be rewritten', (t) => {
  t.plan(1);
  let path = './tests/closure/closure.jsx';
  t.equal(handlebars(path), react(path));
});

test('arrow functions should be rewritten', (t) => {
  t.plan(1);
  let path = './tests/closure/arrow-functions.jsx';
  t.equal(handlebars(path), react(path));
});
