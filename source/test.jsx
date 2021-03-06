/**
 * asdf
 */
import React from 'react';
import SomeComponent from './test2';

const abc = [
	'a',
	'b',
	'c'
];

export default class Test extends React.Component {

  static defaultProps = {
    defaultValue: 'some-default-value',
    nonDefaultValue: 'should-be-overridden'
  };

  render() {
    var classname = ['b'].join(' ').trim();
    var list = abc;
    var someDiv = <div>
        <span>{this.props.defaultValue}</span>
        <span>{this.props.nonDefaultValue}</span>
      </div>;
    var show = this.props.show !== undefined ? this.props.show : true;
    var attrs = {
      a: 'x',
      b: 5,
      c: false
    };

    return (
      <div className={classname} a="b" c={this.props.name}>
        <p a="y" {...attrs} b="6">
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
          ? <SomeComponent {...attrs} name={this.props.name} />
          : null}
        {this.props.children}
        <this.props.name></this.props.name>
      </div>
    );
  }
}
