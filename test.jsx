import React from 'react';
import Component from 'some-component';

export default class Test extends React.Component {
  render() {
    var classname = ['b'].join(' ').trim();
    var list = ['a', 'b'];

    return (
      <div {...classname} className={classname} a="b" c={this.props.name}>
        <p>
          {this.props.name}
        </p>
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
