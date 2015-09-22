import test from 'tape';
import {dirname} from 'path';
import {readFileSync} from 'fs';
import {babelTransform, customRequire, compileTemplate, react} from '../helpers';

test('classes should be able to use if babel already transformed syntax', (t) => {
  t.plan(1);
  let path = './tests/post-babel-classes/class.jsx';

  var dir = dirname(path);
  let source = readFileSync(path);
  let code = babelTransform(source, false, {
    blacklist: [
      'react',
      'es6.modules'
    ]
  });

  t.equal(compileTemplate(customRequire(dir, babelTransform(code)))(), react(path));
});
