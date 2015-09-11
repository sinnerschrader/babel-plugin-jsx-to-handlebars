var path = require('path');
var fs = require('fs');
var babel = require('babel');

var source = fs.readFileSync('plugin2.js');
var result = babel.transform(source, {
  stage: 0
});
fs.writeFileSync('plugin2.dist.js', result.code);

var source = fs.readFileSync('test.jsx');
var result = babel.transform(source, {
  stage: 0,
  plugins: ['./plugin2.dist.js']
});
console.log(result.code);
