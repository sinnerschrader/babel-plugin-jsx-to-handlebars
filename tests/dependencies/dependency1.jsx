import React from 'react';
import Other from './dependency2.jsx';

export default class Main extends React.Component {
  render() {
    var value = 'value';
    return (
      <div>
        <Other value={value} />
      </div>
    );
  }
}
