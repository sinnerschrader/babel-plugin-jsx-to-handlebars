#!/usr/bin/env node

require('babel/register');

var path = require('path');
var glob = require('glob');

glob('./tests/**/*-test.js', function (err, files) {
  files.forEach(function (file) {
    require(path.resolve(process.cwd(), file));
  });
});
