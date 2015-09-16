var fs = require('fs');
var babel = require('babel');
var Handlebars = require('handlebars');

var helpers = function(path) {
  return helpers.compile(helpers.load(helpers.transform(path)));
}

helpers.transform = function(path) {
  var source = fs.readFileSync(path);
  return babel.transform(source, {
    stage: 0,
    plugins: ['../dist/plugin.dist.js']
  }).code;
}

helpers.load = function(code) {
  var mod = {
    exports: {}
  };
  var fn = new Function('module', 'exports', 'require', code);
  fn.call(null, mod, mod.exports, require);
  return mod.exports;
}

helpers.compile = function(templateModule, children) {
  children = children || '';
  templateModule.call(null);
  var name = templateModule.name;
  return Handlebars.compile('{{#>' + name + '}}' + children + '{{/' + name + '}}');
}

module.exports = helpers;
