'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _handlebars = require('handlebars');

var _handlebars2 = _interopRequireDefault(_handlebars);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

if (typeof _classnames2['default'] === 'function') {
	(0, _classnames2['default'])();
}

var _compiledPartial = _handlebars2['default'].compile('<div>Some referenced component</div>');

exports['default'] = function () {
	_handlebars2['default'].registerPartial('Test2', function (context, execOptions) {
		var localContext = {};
		localContext.props = execOptions.hash;
		localContext.props.children = new _handlebars2['default'].SafeString(execOptions.data['partial-block'](context));

		return new _handlebars2['default'].SafeString(_compiledPartial.call(this, localContext, execOptions));
	});
};

module.exports = exports['default'];