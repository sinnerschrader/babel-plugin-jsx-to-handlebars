import React from 'react';
import Children2 from './children2.jsx';

export default class Children1 extends React.Component {
  render() {
    return (
      <Children2>
        <span></span>
      </Children2>
    );
  }
}
