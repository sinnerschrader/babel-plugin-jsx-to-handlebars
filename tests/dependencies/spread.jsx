import React from 'react';
import Other from './dependency2.jsx';

export default class Spread extends React.Component {
  render() {
    let spread = {
      'data-a': "2",
      'data-b': "3",
      'data-c': "4"
    };
    return (
      <Other data-a="1" {...spread} data-c="5"></Other>
    );
  }
}
