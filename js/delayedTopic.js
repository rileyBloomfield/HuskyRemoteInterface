/*
* Nick Reid, 2015
*/

Math.clamp = function(a, b, c) {
	if(b < a) { return a; }
	else if(b > c) { return c; }
	else { return b; }
}

function DelayedQueue(delay, onPop) {
	this.delay = delay;
	this._queue = [];
	this.onPop = onPop || function() { };
}

DelayedQueue.prototype = {
	push: function(item) {
		this._queue.push(this._constructEntry(item));

		if(this._queue.length == 1) { 
			var boundCall = this._onPop.bind(this);
			setTimeout(boundCall, this.delay, boundCall);
		}
	},
	_onPop: function(boundCall) {
		this.onPop(this._queue[0].item);
		this._queue.splice(0, 1);

		var next = this._queue[0];
		if(next) {
			setTimeout(boundCall, this.delay - (Date.now() - next.when), boundCall); //Run at delay - timeInQueue
		}
	},
	_constructEntry(item) {
		return { item: item, when: Date.now() }
	}
}

function DelayedRosTopic(topic, delay) {
	var that = this;

	this._topic = topic;
	this._topic.subscribe(function(message) { that._subscriptionQueue.push(message); });

	this._publishQueue = new DelayedQueue(delay, function(message) { that._topic.publish(message); });
	this._subscriptionQueue = new DelayedQueue(delay);
}

DelayedRosTopic.prototype = {
	publish: function(message) { this._publishQueue.push(message); },

	subscribe: function(subscription) { this._subscriptionQueue.onPop = subscription; },

	setDelay: function(delay) { 
		this._subscriptionQueue.delay = delay;
		this._publishQueue.delay = delay;
	}
}