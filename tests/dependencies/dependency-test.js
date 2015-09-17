import test from 'tape';
import {handlebars, react} from '../helpers';

test('dependencies should be resolved and rendered as block-partials', (t) => {
  t.plan(1);
  let path = './tests/dependencies/dependency1.jsx';
  t.equal(handlebars(path), react(path));
});

test('children should be rendered properly', (t) => {
  t.plan(1);
  let path = './tests/dependencies/children1.jsx';
  t.equal(handlebars(path), react(path));
});
