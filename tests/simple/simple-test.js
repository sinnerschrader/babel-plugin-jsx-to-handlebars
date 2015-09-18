import test from 'tape';
import {handlebars, react} from '../helpers';

test('hello world', (t) => {
  t.plan(1);
  let path = './tests/simple/simple.jsx';
  t.equal(handlebars(path), react(path));
});

test('multiple expressions', (t) => {
  t.plan(1);
  let path = './tests/simple/multiple-jsx-expressions.jsx';
  t.equal(handlebars(path), react(path));
});

test('html void elements', (t) => {
  t.plan(1);
  let path = './tests/simple/void-elements.jsx';
  t.equal(handlebars(path), react(path));
});
