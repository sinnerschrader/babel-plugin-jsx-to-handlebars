import React from 'react';

export default class Guard extends React.Component {
  render() {
    let show = true;
    return (
      <div>
        <ul>
          {show && <li></li>}
          {show ? <li></li> : null}
        </ul>
        {show && ['a', 'b', 'c'].join(' ')}
      </div>
    );
  }
}
