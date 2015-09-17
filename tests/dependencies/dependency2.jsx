import React from 'react';

export default class SubComponent extends React.Component {
  render() {
    return (
      <span>{this.props.value}</span>
    );
  }
}
