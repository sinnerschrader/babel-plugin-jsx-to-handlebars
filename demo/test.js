/*
 React -> react
 Component -> some-component
*/
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var abc = ['a', 'b', 'c'];

var _compiledPartial = Handlebars.compile('<span></span>');

var _compiledPartial2 = Handlebars.compile('<div className="{{_var}}" a="b" c="{{props.name}}">\n        <p>\n          {{props.name}}\n        </p>\n        {{_var2}}\n        <img />\n        {{#if _testHelperVar}}<h1>show is true</h1>{{/if}}\n        <ul>\n          {{_callResult}}\n        </ul>\n        {{#if _testHelperVar2}}<Component />{{else}}null{{/if}}\n        {{props.children}}\n      </div>');

var _compiledPartial3 = Handlebars.compile('<li className="{{props.name}}">{{_var3}}</li>');

exports['default'] = function () {
  Handlebars.registerPartial('Test', function (context, execOptions) {
    var localContext = {};
    localContext.props = execOptions.hash;
    localContext.props.children = new Handlebars.SafeString(execOptions.data['partial-block'](context));
    localContext._var = ['b'].join(' ').trim();

    var list = abc;
    localContext._var2 = new Handlebars.SafeString(_compiledPartial.call(this, localContext, execOptions));

    var show = localContext.props.show !== undefined ? localContext.props.show : true;

    localContext._testHelperVar = show;

    localContext._callResult = (function (result) {
      return Array.isArray(result) ? new Handlebars.SafeString(result.join('')) : result;
    })(list.map(function (item) {
      var localContext = Object.assign({}, localContext);
      localContext._var3 = item;

      return new Handlebars.SafeString(_compiledPartial3.call(this, localContext, execOptions));
    }));

    localContext._testHelperVar2 = true == true;
    return new Handlebars.SafeString(_compiledPartial2.call(this, localContext, execOptions));
  });
};

module.exports = exports['default'];