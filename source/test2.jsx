import * as React from 'react';
import classnames from 'classnames';

export default class Test2 extends React.Component {

	static defaultProps = {
		href: '#',
		caption: 'Lorem ipsum dolor',
		image: {},
		prices,
		component: 'figure'
	};

	render() {
		return (
			<div>Some referenced component: Given {this.props.name}</div>
		);
	}
}
