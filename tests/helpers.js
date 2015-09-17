import * as fs from 'fs';
import * as babel from 'babel';
import Handlebars from 'handlebars';
import React from 'react';

export function handlebars(path, data = {}) {
  return compileTemplate(customRequire(babelTransform(path)), undefined, data)();
}

export function react(path, data = {}) {
  var Component = customRequire(babelTransform(path, false));
  return React.renderToStaticMarkup(React.createElement(Component, data));
}

export function babelTransform(path, enablePlugin = true) {
  var source = fs.readFileSync(path);
  return babel.transform(source, {
    stage: 0,
    plugins: enablePlugin ? ['../dist/plugin.dist.js'] : []
  }).code;
}

export function customRequire(code) {
  var mod = {
    exports: {}
  };
  var fn = new Function('module', 'exports', 'require', code);
  fn.call(null, mod, mod.exports, require);
  return mod.exports;
}

export function compileTemplate(templateModule, children = '', data = {}) {
  templateModule.call(null);
  let name = templateModule.name;
  let props = Object.keys(data).map(key => `${key}="${data[key]}"`).join(' ');  
  return Handlebars.compile(`{{#>${name} ${props}}}${children}{{/${name}}}`);
}
