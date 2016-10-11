import React from 'react';

export default class Closure extends React.Component {
  render() {
    const list = ['a', 'b'];
    return (
      <ul>
        {list.map(function(item, index) {
          return <li key={index}>{index}. {item}</li>
        })}
      </ul>
    );
  }
}
