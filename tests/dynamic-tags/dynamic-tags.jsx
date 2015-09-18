import React from 'react';

export default class Guard extends React.Component {
  render() {
    let obj = {
      tag: 'div'
    };
    this.props.custom = this.props.custom || 'div';
    return (
      <div>
        <obj.tag></obj.tag>
        <this.props.custom></this.props.custom>
      </div>
    );
  }
}
