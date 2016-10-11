import {handlebars, react} from '../helpers';
import test from 'tape';
const log = console.log.bind(console);

test.only('closures should be rewritten', t => {
  t.plan(1);
  const path = './tests/closure/closure.jsx';
  t.equal(handlebars(path), react(path));
});

test('arrow functions should be rewritten', t => {
  t.plan(1);
  const path = './tests/closure/arrow-functions.jsx';
  t.equal(handlebars(path), react(path));
});
