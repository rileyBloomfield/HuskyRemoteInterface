
//Ros Elements
var ws, ros;

//Ros Topics
var cmdVel;
var linX=0, linY=0, linZ=0, anX=0, anY=0, anZ=0;

//Toggles
var drivable = false;

var IPAddress = "129.100.227.225";

$(document).ready(function() {
	window.gamepad = new Gamepad();
	gamepad.bind(Gamepad.Event.CONNECTED, function(device) {
		console.log('Connected', device);
		$('#gamepadInfo').html(device.id);
	});
	gamepad.bind(Gamepad.Event.DISCONNECTED, function(device) { console.log('Disconnected', device); 
		$('#gamepadInfo').html("");
	});
	gamepad.bind(Gamepad.Event.TICK, function(gamepads) { });
	gamepad.bind(Gamepad.Event.BUTTON_DOWN, function(e) { buttonPressed(e); });
	gamepad.bind(Gamepad.Event.BUTTON_UP, function(e) { buttonUp(e); });
	gamepad.bind(Gamepad.Event.AXIS_CHANGED, function(e) { axisChanged(e); });
	if (!gamepad.init()) {
		alert('Your browser does not support gamepads, get the latest Google Chrome or Firefox.');
	}

	ros = new ROSLIB.Ros({
        url : 'ws://'+IPAddress+':9090'
    });
    initRos();
});

function buttonPressed(e) {
	console.log("Gamepad:" + e.gamepad.index + " Button: "+ e.control);
	if(e.control == "FACE_3") {
		$('#driveIndicator').html("Drive Enabled");
		drivable = true;
		return;
	}
};

function buttonUp(e) {
	console.log("Gamepad:" + e.gamepad.index + " Button: "+ e.control);
	if(e.control == "FACE_3") {
		$('#driveIndicator').html("Drive Disabled");
		drivable = false;
		linX = 0;
		anZ = 0;
	}
};

function axisChanged(e) {
	console.log("Gamepad:"+ e.gamepad.index + " Axis:"+ e.axis+ " Value: "+e.value);
	if(e.axis == "LEFT_STICK_Y" && drivable) {
 		linX = -0.5*parseFloat(e.value); //left stick up and down
	}
	if(e.axis == "LEFT_STICK_X" && drivable) {
		anZ = 0.25*parseFloat(e.value);
	}
};

function setVideoQuality() {
	var value = $('#videoQualityInput').val();
	var string = "http://"+IPAddress+":8080/stream?topic=/camera/image_color&quality="+value;
	$("#videoStream").attr("src",string);
};

function initRos() {
	ros.on('connection', function() {
        console.log('Connected to websocket server.');
    });

    ros.on('error', function(error) {
        console.log('Error connecting to websocket server: ', error);
    });

    ros.on('close', function() {
        console.log('Connection to websocket server closed.');
    });

    cmdVel = new ROSLIB.Topic({
        ros : ros,
        name : '/husky/cmd_vel',
        messageType : 'geometry_msgs/Twist'
    });
};

function changeIP() {
	IPAddress = $('#IPAddressInput').val();
};

window.setInterval(function() {
	if(ros) {
		var twist = new ROSLIB.Message({
			linear : {
 				x : linX, //left stick up and down
        		y : linY,
    			z : linZ
 			},
			angular : {
   				x : -anX,
 				y : -anY,
 				z : -anZ //left stick left and right
			}
		});
		cmdVel.publish(twist);
	}
	else {
		console.log("Failed to publish twist. ROS may not be initialized.");
	}
}, 100);

