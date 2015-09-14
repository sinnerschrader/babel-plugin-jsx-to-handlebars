var path = require('path');
var fs = require('fs');
var babel = require('babel');

var source = fs.readFileSync('source/test.jsx');
var result = babel.transform(source, {
  stage: 0,
  plugins: ['./plugin.dist.js']
});
console.log(result.code);
