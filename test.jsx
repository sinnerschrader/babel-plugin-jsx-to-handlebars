import React from 'react';
import Component from 'some-component';

export default class Test extends React.Component {
  render() {
    var classname = ['b'].join(' ').trim();
    var list = ['a', 'b'];
    var someDiv = <span></span>;

    return (
      <div className={classname} a="b" c={this.props.name}>
        <p>
          {this.props.name}
        </p>
        {someDiv}
        <img />
        <ul>
          {list.map(function(item) {
            return (<li className={this.props.name}>{item}</li>);
          })}
        </ul>
        <Component />
      </div>
    );
  }
}
