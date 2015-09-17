import React from 'react';

export default class MultipleJSXExpressions extends React.Component {
  render() {
    let someOtherExpression = (
	  <span></span>
	);
    return (
	  <div>
	    {someOtherExpression}
	  </div>
	);
  }
}
