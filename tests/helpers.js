import * as path from 'path';
import * as fs from 'fs';
import * as babel from 'babel';
import Handlebars from 'handlebars';
import React from 'react';

export function handlebars(file, data = {}) {
  var dir = path.dirname(file);
  let source = fs.readFileSync(file);
  return compileTemplate(customRequire(dir, babelTransform(source)), undefined, data)();
}

export function react(file, data = {}) {
  let Component = require(path.resolve(__dirname, '..', file));
  return React.renderToStaticMarkup(React.createElement(Component, data));
}

export function babelTransform(source, enablePlugin = true, opts = {}) {
  let localOpts = Object.assign(opts, {
    stage: 0,
    plugins: enablePlugin ? ['../dist/plugin.dist.js'] : []
  });
  return babel.transform(source, localOpts).code;
}

export function customRequire(dir, code) {
  let commonjs = function(code) {
    let mod = {
      exports: {}
    };
    let req = function(id) {
      if (id[0] == '.') {
        id = './' + path.join(dir, id);
        let source = fs.readFileSync(id);
        return commonjs(babelTransform(source));
      } else {
        return require(id);
      }
    }
    let fn = new Function('module', 'exports', 'require', code);
    fn.call(null, mod, mod.exports, req);
    return mod.exports;
  }
  return commonjs(code);
}

export function compileTemplate(templateModule, children = '', data = {}) {
  templateModule.call(null);
  let name = templateModule.name;
  let props = Object.keys(data).map(key => `${key}="${data[key]}"`).join(' ');  
  return Handlebars.compile(`{{#>${name} ${props}}}${children}{{/${name}}}`);
}
