/*
* Riley Bloomfield, 2015
*/

var network = {
	IPAddress: "172.31.248.8",
	videoPort: "8080",
	websocketPort: "9090"
}

var globalModel = { 
	delay: 0,
	positionLog: [],
	position: { 
		latitude: 0, 
		longitude: 0, 
		time: 0
	},
	twist: {
		linear : {
			x : 0, //left stick up and down
    		y : 0,
			z : 0
		},
		angular : {
			x : 0,
			y : 0,
			z : 0 //left stick left and right
		}
	},
	sensitivity: {
		linear: 0.5,
		angular: 0.25
	}
};

$(document).ready(function() {

	initRos(globalModel);
	var canvasMethods = initCanvas(globalModel.twist);
	initGamepad(globalModel, canvasMethods);
	initVideoStream(globalModel);
    initMap(globalModel.position);

    //Set status values
    $('#IPIndicator').html(network.IPAddress);
    $('#videoPortIndicator').html(network.videoPort);
    $('#websocketPortIndicator').html(network.websocketPort);

    //Set radio button defaults and handlers
    $("#defaultLinSens").prop("checked", true);
    $("#defaultAnSens").prop("checked", true);
    $('input[type=radio][name=linSens]').change(function() {
        globalModel.sensitivity.linear = parseFloat($("input[name=linSens]:checked").val());
    });
    $('input[type=radio][name=anSens]').change(function() {
        globalModel.sensitivity.angular = parseFloat($("input[name=anSens]:checked").val());
    });
});

function initCanvas(twist) {
	    //Prep Canvas
    var canvas = document.querySelector('canvas');
    var ctx = canvas.getContext('2d');

	var ret = {
		drawAxisPosition: function(twist) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.beginPath();
			ctx.moveTo(50,0);
			ctx.lineTo(50,100);
			ctx.stroke();

			ctx.beginPath();
			ctx.moveTo(0,50);
			ctx.lineTo(100,50);
			ctx.stroke();

			ctx.beginPath();
		    ctx.arc((twist.angular.z*canvas.width)+(canvas.width/2), (-twist.linear.x*canvas.height)+(canvas.height/2), 10, 0, 2 * Math.PI, false);
		    ctx.fillStyle = 'green';
		    ctx.fill();
		}
	}
    ret.drawAxisPosition(twist); //Draw initial 0,0 position
    return ret;
}

function initGamepad(model, methods) {
	var gamepad = new Gamepad();

	gamepad.bind(Gamepad.Event.CONNECTED, function(device) {
		console.log('Connected', device);
		$('#gamepadInfo').html(device.id);
	});
	gamepad.bind(Gamepad.Event.DISCONNECTED, function(device) { console.log('Disconnected', device); 
		$('#gamepadInfo').html("");
	});

	gamepad.bind(Gamepad.Event.TICK, function(gamepads) { });

	gamepad.bind(Gamepad.Event.BUTTON_DOWN, function(e) {
		if(e.control == "FACE_3") {
			$('#driveIndicator').html("Drive Enabled");
			$('#driveIndicator').attr("class","enabled");
			drivable = true;
			return;
		}
	});
	gamepad.bind(Gamepad.Event.BUTTON_UP, function(e) {
		if(e.control == "FACE_3") { //if A button is released
			$('#driveIndicator').html("Drive Disabled");
			$('#driveIndicator').attr("class","disabled");
			drivable = false;
			model.twist.linear.x = 0;
			model.twist.angular.z = 0;
			methods.drawAxisPosition(twist);
		}
	});
	gamepad.bind(Gamepad.Event.AXIS_CHANGED, function(e) {
		if(e.axis == "LEFT_STICK_Y" && drivable) {
	 		model.twist.linear.x = -model.sensitivity.linear*parseFloat(e.value); //left stick up and down
	 		methods.drawAxisPosition(twist);
		}
		if(e.axis == "LEFT_STICK_X" && drivable) {
			model.twist.angular.z = model.sensitivity.angular*parseFloat(e.value); //left stick left and right
			methods.drawAxisPosition(twist);
		}
	});
	if (!gamepad.init()) {
		alert('Your browser does not support gamepads. Use the latest version of Google Chrome.');
	}
}

function initVideoStream(model) {
	var $videoStream = $("#videoStream"),
		uri,
		delayedQueue = new DelayedQueue(model, function(item) {
			$videoStream.attr('src', 
	        	'data:image/jpeg;base64,'+btoa(String.fromCharCode.apply(null, new Uint8Array(item)))
        	);
		});

	onload = function() {
        delayedQueue.push(this.response);
    };

	window.setVideoQuality = function() {
		var box = $('#videoQualityInput');
			quality = Math.clamp(1, box.val(), 20);
		box.val(quality);

		uri = 'http://'+network.IPAddress+':'+network.videoPort+'/snapshot?topic=/camera/image_color&quality='+quality;
	};

	setVideoQuality();

	setInterval(function() { 
		var xmlHTTP = new XMLHttpRequest();
		xmlHTTP.open('GET', uri, true);
		xmlHTTP.responseType = 'arraybuffer';
		xmlHTTP.onload = onload;
   		xmlHTTP.send(); 
	}, 60); //no more than 66, muse be at least 15Hz to keep up with camera FPS
};

function initRos(model) {
	var drivable = false;

	var ros = new ROSLIB.Ros({
        url : 'ws://'+network.IPAddress+':'+network.websocketPort
    });

	ros.on('connection', function() {
        console.log('Connected to websocket server on: '+ network.IPAddress);
    });

    ros.on('error', function(error) {
        console.log('Error connecting to websocket server: ', error);
    });

    ros.on('close', function() {
        console.log('Connection to websocket server closed on: '+ network.IPAddress);
    });

    var delayedCmdVel = new DelayedRosTopic(new ROSLIB.Topic({
        ros : ros,
        name : '/husky/cmd_vel',
        messageType : 'geometry_msgs/Twist'
    }), model);

    var delayedNavSatFix = new DelayedRosTopic(new ROSLIB.Topic({
    	ros : ros,
    	name : '/gps/fix',
    	messageType : 'sensor_msgs/NavSatFix'
    }), model);

    var delayedTimeReference = new DelayedRosTopic(new ROSLIB.Topic({
    	ros : ros,
    	name : '/gps/time_reference',
    	messageType : 'sensor_msgs/TimeReference'
    }), model);

    var delayedCounter = new DelayedRosTopic(new ROSLIB.Topic({
    	ros : ros,
    	name : '/husky/counter',
    	messageType : 'geometry_msgs/Point'
    }), model);

    //Subscriptions
    delayedNavSatFix.subscribe(function(message) {
    	globalModel.position.latitude = message.latitude;
    	globalModel.position.longitude = message.longitude;
    });

    delayedTimeReference.subscribe(function(message) {
    	moveMarker();
    	globalModel.position.time = message.time_ref.secs;
    	var $logBody = $('#logTableBody');
    	with(globalModel.position) {
    		$logBody.append('<tr><td>'+latitude+'</td><td>'+longitude+'</td><td>'+time+'</td><tr>');
	    	model.positionLog.push([latitude, longitude, time]);
			$('#scrollDiv').scrollTop($('#scrollDiv')[0].scrollHeight);
    	}
    }, 1000);

    setInterval(function() {
		if(ros) {
			delayedCmdVel.publish(new ROSLIB.Message(model.twist));
		}
		else {
			console.log("Failed to publish twist. ROS may not be initialized.");
		}
	}, 100); //10Hz
};

function changeIP() {
	network.IPAddress = $('#IPAddressInput').val();
	initRos();
	$('#IPIndicator').html(network.IPAddress);
};

function changeDelay() {
	globalModel.delay = $('#delayInput').val();
	$('#delayIndicator').html(globalModel.delay);
	globalModel.delay *= 1000;
}

function initMap(position) {
  var myLatlng = new google.maps.LatLng(position.latitude, position.longitude);
  var mapOptions = {
    zoom: 18,
    center: myLatlng
  }
  var map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
  var marker = new google.maps.Marker({
      position: myLatlng,
      map: map,
      title: 'Location'
  });
  window.moveMarker = function() {
  		marker.setPosition( new google.maps.LatLng(position.latitude, position.longitude ) );
    	map.panTo( new google.maps.LatLng(position.latitude, position.longitude ) );
	}
}

function clearLog() {
	var r = confirm("Clear Position Logs?");
	if (r == true) {
		globalModel.positionLog = [];
		$('#logTableBody').html('');
	}
}

function saveLog() {
	var content = globalModel.positionLog.map(function(item) { return item.join(); }).join('\n');
    var contentType = 'application/octet-stream';
    var filename = 'positionLog';
    var fileExtension = ".csv";

    if(!contentType) contentType = 'application/octet-stream';
    var a = document.createElement('a');
    var blob = new Blob([content], {'type':contentType});
    a.href = window.URL.createObjectURL(blob);
    a.download = filename+fileExtension;
    a.click();
}