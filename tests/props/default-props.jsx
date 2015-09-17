import React from 'react';

export default class DefaultProps extends React.Component {
  static defaultProps = {
    property: 'default-value'
  }

  render() {
    return <div>{this.props.property}</div>
  }
}
