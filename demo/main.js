require('./test')();
var Handlebars = require('handlebars');

var main = Handlebars.compile(document.querySelector('#main').text);
window.app.innerHTML = main();
