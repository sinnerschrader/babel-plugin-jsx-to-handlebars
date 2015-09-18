import React from 'react';

export default class Guard extends React.Component {
  render() {
    let obj = {
      tag: 'div'
    };
    return (
      <div>
        <obj.tag></obj.tag>
      </div>
    );
  }
}
