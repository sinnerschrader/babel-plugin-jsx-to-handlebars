/**
 * asdf
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _handlebars = require('handlebars');

var _handlebars2 = _interopRequireDefault(_handlebars);

var _test2 = require('./test2');

var _test22 = _interopRequireDefault(_test2);

if (typeof _test22['default'] === 'function') {
  (0, _test22['default'])();
}

var abc = ['a', 'b', 'c'];

var _compiledPartial = _handlebars2['default'].compile('<span></span>');

var _compiledPartial2 = _handlebars2['default'].compile('<div className="{{_var}}" a="b" c="{{props.name}}">\n        <p>\n          {{props.name}}\n        </p>\n        {{_var2}}\n        <img />\n        {{#if _testHelperVar}}<h1>show is true</h1>{{/if}}\n        <ul>\n          {{_callResult}}\n        </ul>\n        {{#if _testHelperVar2}}<Test2 />{{else}}null{{/if}}\n        {{props.children}}\n      </div>');

var _compiledPartial3 = _handlebars2['default'].compile('<li className="{{props.name}}">{{_var3}}</li>');

exports['default'] = function () {
  _handlebars2['default'].registerPartial('Test', function (context, execOptions) {
    var localContext = {};
    localContext.props = execOptions.hash;
    localContext.props.children = new _handlebars2['default'].SafeString(execOptions.data['partial-block'](context));
    localContext._var = ['b'].join(' ').trim();

    var list = abc;
    localContext._var2 = new _handlebars2['default'].SafeString(_compiledPartial.call(this, localContext, execOptions));

    var show = localContext.props.show !== undefined ? localContext.props.show : true;

    localContext._testHelperVar = show;

    localContext._callResult = (function (result) {
      return Array.isArray(result) ? new _handlebars2['default'].SafeString(result.join('')) : result;
    })(list.map(function (item) {
      var localContext = Object.assign({}, localContext);
      localContext._var3 = item;

      return new _handlebars2['default'].SafeString(_compiledPartial3.call(this, localContext, execOptions));
    }));

    localContext._testHelperVar2 = true == true;
    return new _handlebars2['default'].SafeString(_compiledPartial2.call(this, localContext, execOptions));
  });
};

module.exports = exports['default'];