import * as React from 'react';
import classnames from 'classnames';

import Image from 'image';
import Headline from 'headline';
import Copy from 'copy';
import Price from 'price';

const srcset = [
	'//is.s2.de/320x145/dddddd/fefefe/320x121.png 320w',
	'//is.s2.de/416x157/dddddd/fefefe/416x157.png 416w',
	'//is.s2.de/540x204/dddddd/fefefe/540x204.png 540w',
	'//is.s2.de/700x265/dddddd/fefefe/700x265.png 700w',
	'//is.s2.de/910x344/dddddd/fefefe/910x344.png 910w'
];

const prices = [
	{
		prefix: 'Ab',
		value: '123,45',
		currency: '€',
		period: '/Monat',
		'href': '#',
		disclaimer: '*',
		'disclaimer-href': '#'
	},
	{
		prefix: 'oder',
		value: '10.000,00',
		currency: '€',
		disclaimer: '2'
	}
];

export default class CarTile extends React.Component {

	static propTypes = {
		href: React.PropTypes.string,
		caption: React.PropTypes.string,
		image: React.PropTypes.object,
		prices: React.PropTypes.array,
		component: React.PropTypes.string
	};

	static defaultProps = {
		href: '#',
		caption: 'Lorem ipsum dolor',
		image: {},
		prices,
		component: 'figure'
	};

	render() {
		let Component = this.props.component;
		let className = classnames('car-tile', this.props.className);
		let image = {srcset, ...this.props.image};

		return (
			<Component className={className}>
				<a className="car-tile-link" href={this.props.href}>
					{image && <Image />}
					{this.props.caption &&
						<Headline className="headline--no-margin" component="figcaption" order="5">
							{this.props.caption}
						</Headline>}
				{this.props.claim ?
					<Copy className="copy--no-margin" order="2">
						{this.props.claim}
					</Copy> : null}
				</a>
				{this.props.prices.map((price) => <Price />)}
			</Component>
		);
	}
}
