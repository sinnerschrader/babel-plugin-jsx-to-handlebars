var path = require('path');
var fs = require('fs');
var babel = require('babel');

var source = fs.readFileSync('test.jsx');
var result = babel.transform(source, {
  stage: 0,
  plugins: ['./plugin2.dist.js']
});
console.log(result.code);
fs.writeFileSync('test.js', result.code);

