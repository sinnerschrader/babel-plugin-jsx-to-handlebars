import React from 'react';

export default class Arrow extends React.Component {
  render() {
    let list = [
      'a',
      'b'
    ];
    return (
      <div>
        <ul>
          {list.map((item, index) => <li key={index}>{index}. {item}</li>)}
        </ul>
        <ul>
          {list.map((item, index) => {
            return <li key={index}>{index}. {item}</li>
          })}
        </ul>
      </div>
    );
  }
}
