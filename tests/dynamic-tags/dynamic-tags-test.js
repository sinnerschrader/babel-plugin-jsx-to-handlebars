import test from 'tape';
import {handlebars, react} from '../helpers';

test('support dynamic-tags', (t) => {
  t.plan(1);
  let path = './tests/dynamic-tags/dynamic-tags.jsx';
  t.equal(handlebars(path), react(path));
});
