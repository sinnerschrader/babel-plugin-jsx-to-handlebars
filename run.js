var path = require('path');
var fs = require('fs');
var babel = require('babel');

var source = fs.readFileSync('test.jsx');
var result = babel.transform(source, {
  plugins: ['./plugin.js']
});
console.log(result.code);
