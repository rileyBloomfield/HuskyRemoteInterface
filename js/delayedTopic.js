/*
* Nick Reid, 2015
*/

Math.clamp = function(a, b, c) {
	if(b < a) { return a; }
	else if(b > c) { return c; }
	else { return b; }
}

function DelayedQueue(delayModel, onPop) {
	this.delayModel = delayModel;
	this._queue = [];
	this.onPop = onPop || function() { };
}

DelayedQueue.prototype = {
	push: function(item) {
		this._queue.push(this._constructEntry(item));

		if(this._queue.length == 1) { 
			setTimeout(this._onPop, this.delayModel.delay, this);
		}
	},
	_onPop: function(that) {
		that.onPop(that._queue[0].item);
		that._queue.splice(0, 1);

		var next = that._queue[0];
		if(next) {
			setTimeout(that._onPop, that.delayModel.delay - (Date.now() - next.when), that); //Run at delay - timeInQueue
		}
	},
	_constructEntry(item) {
		return { item: item, when: Date.now() }
	}
}

function DelayedRosTopic(topic, delayModel) {
	var that = this;

	this._topic = topic;
	this._topic.subscribe(function(message) { that._subscriptionQueue.push(message); });

	this._publishQueue = new DelayedQueue(delayModel, function(message) { that._topic.publish(message); });
	this._subscriptionQueue = new DelayedQueue(delayModel);
}

DelayedRosTopic.prototype = {
	publish: function(message) { this._publishQueue.push(message); },

	subscribe: function(subscription) { this._subscriptionQueue.onPop = subscription; },
}