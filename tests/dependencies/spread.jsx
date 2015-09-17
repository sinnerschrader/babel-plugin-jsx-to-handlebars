import React from 'react';

export default class Spread extends React.Component {
  render() {
    let spread = {
      'data-a': "2",
      'data-b': "3",
      'data-c': "4"
    };
    return (
      <div data-a="1" {...spread} data-c="5"></div>
    );
  }
}
