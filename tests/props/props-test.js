import test from 'tape';
import {handlebars, react} from '../helpers';

test('undefined props should be ignored in output', (t) => {
  t.plan(1);
  let path = './tests/props/props.jsx';
  t.equal(handlebars(path), react(path));
});

test('props should be rendered into output', (t) => {
  t.plan(1);
  let path = './tests/props/props.jsx';
  let data = {property: 'property'};
  t.equal(handlebars(path, data), react(path, data));
});

test('defaultProps should be rendered into output if not set', (t) => {
  t.plan(1);
  let path = './tests/props/default-props.jsx';
  let data = {};
  t.equal(handlebars(path, data), react(path, data));
});

test('defaultProps should be overwritten if set', (t) => {
  t.plan(1);
  let path = './tests/props/default-props.jsx';
  let data = {property: 'overwritten'};
  t.equal(handlebars(path, data), react(path, data));
});

test('spread props should be overwritten by order of occurence', (t) => {
  t.plan(1);
  let path = './tests/props/spread.jsx';
  t.equal(handlebars(path), react(path));
});

test('react special-props should be respected', (t) => {
  t.plan(1);
  let path = './tests/props/special-props.jsx';
  t.equal(handlebars(path), react(path));
});
