/*
var TestClass = (function (_React$Component) {
  _inherits(TestClass, _React$Component);

  function TestClass() {
    _classCallCheck(this, TestClass);

    _get(Object.getPrototypeOf(TestClass.prototype), 'constructor', this).apply(this, arguments);
  }

  _createClass(TestClass, [{
    key: 'render',
    value: function render() {
      return new _handlebars2['default'].SafeString(_compiledPartial.call(this, localContext, execOptions));
    }
  }], [{
    key: 'defaultProps',
    value: {
      'key': 'value'
    },
    enumerable: true
  }]);

  return TestClass;
})(React.Component);
*/

import React from 'react';

export default class TestClass extends React.Component {
  static defaultProps = {
    'key': 'value'
  }

  render() {
    return <div>{this.props.key}</div>;
  }
}
