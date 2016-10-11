#!/usr/bin/env node
require('babel-register');

const path = require('path');
const glob = require('glob');

glob('./tests/**/*-test.js', (err, files) => {
  if (err) {
    throw err;
  }
  files.forEach(file => {
    require(path.resolve(process.cwd(), file));
  });
});
