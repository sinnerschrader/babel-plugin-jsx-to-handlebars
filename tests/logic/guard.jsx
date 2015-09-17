import React from 'react';

export default class Guard extends React.Component {
  render() {
    let show = true;
    return (
      <ul>
        {show && <li></li>}
      </ul>
    );
  }
}
