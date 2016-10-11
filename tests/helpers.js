import * as babel from 'babel-core';
import Handlebars from 'handlebars';
import React from 'react';
import fs from 'fs';
import path from 'path';
import requireFromString from 'require-from-string';

export function handlebars(file, data = {}) {
  const dir = path.dirname(file);
  const source = fs.readFileSync(file, 'utf-8'); // eslint-disable-line no-sync
  const transformed = babelTransform(source);
  return compileTemplate(customRequire(dir, transformed).default, undefined, data)();
}

export function react(file, data = {}) {
  const source = fs.readFileSync(file, 'utf-8'); // eslint-disable-line no-sync
  const transformed = babelTransform(source, false);
  const Component = requireFromString(transformed).default;
  return React.renderToStaticMarkup(React.createElement(Component, data));
}

export function babelTransform(source, enablePlugin = true, opts = {}) {
  let localOpts = Object.assign(opts, {
    presets: ['es2015', 'stage-0', 'react'],
    plugins: enablePlugin ? ['./dist/plugin.dist.js'] : []
  });
  return babel.transform(source, localOpts).code;
}

export function customRequire(dir, code) {
  function commonjs(code) {
    const mod = {exports: {}};
    function req(id) {
      if (id[0] == '.') {
        id = './' + path.join(dir, id);
        const source = fs.readFileSync(id); // eslint-disable-line no-sync
        return commonjs(babelTransform(source));
      } else {
        return require(id);
      }
    }
    const fn = new Function('module', 'exports', 'require', code); // eslint-disable-line no-new-func
    fn(mod, mod.exports, req);
    return mod.exports;
  }
  return commonjs(code);
}

export function compileTemplate(templateModule, children = '', data = {}) {
  templateModule();

  const name = templateModule.name;
  const props = Object.keys(data)
    .map(key => `${key}="${data[key]}"`)
    .join(' ');

  const template = `{{#> ${name} ${props}}}${children}{{/${name}}}`;
  return Handlebars.compile(template);
}
