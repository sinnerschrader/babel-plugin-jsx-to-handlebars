/**
 * asdf
 */
import React from 'react';
import Component from 'some-component';

const abc = [
	'a',
	'b',
	'c'
];

export default class Test extends React.Component {
  render() {
    var classname = ['b'].join(' ').trim();
    var list = abc;
    var someDiv = <span></span>;
    var show = typeof(this.props.show) != 'undefined' ? this.props.show : true;

    return (
      <div className={classname} a="b" c={this.props.name}>
        <p>
          {this.props.name}
        </p>
        {someDiv}
        <img />
        {show && <h1>show is true</h1>}
        <ul>
          {list.map(function(item) {
            return (<li className={this.props.name}>{item}</li>);
          })}
        </ul>
        {true == true 
          ? <Component />
          : null}
        {this.props.children}
      </div>
    );
  }
}
