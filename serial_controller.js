// ====================================
// Serial Robot Control from node.js
//  with Web server and socket.io
// ====================================

// Setting Modules
var Repeat = require('repeat'),
    util = require('util'),
    express = require('express'),
    fs = require('fs'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    spawn = require('child_process').spawn,
    sudo = require('sudo');

// Global Settings
var local_ip = '192.168.2.2';
var SerialPort = require("serialport").SerialPort;

var musicfile = '/music/flag.mp3';

var SERIAL_PORT = "/dev/ttyAMA0", BAUDRATE = 38400;

var CENTER = 110, MOTORS = 12;
var motorMap = [5, 6, 8, 9, 11, 12,  22, 23, 19, 20, 16, 17],
    motorSigns = [1, -1, 1, -1, 1, -1,  -1, 1, -1, 1, -1, 1],
    motorOffset = [0, 0, -5, -5, 0, 0,  -8, 1, 2, 2, -8, 0];
var MOTOR_MAX_ANGLE = 80;

var speed_settings = {
    0: {speed: 8, tmax: 15},
    1: {speed: 9, tmax: 12},
    2: {speed: 10, tmax: 10},
    3: {speed: 12, tmax: 6},
    4: {speed: 15, tmax: 5},
    5: {speed: 15, tmax: 4},
}

var ctrls = {
    tcnt: 0,
    queue: [2, 3, 1, 4],
    qindex: 0,
    initflg: true,
    tmax: speed_settings[3].tmax,
    speed: speed_settings[3].speed,
    data: {
        direction: 'i',
        speed: 3,
        raise: 40,
        swing: 50
    }
};

var ADcommand = new Buffer([0xFD, 0x04, 0x05, 0xFE]);

// Server Settings
app.set('port', 3000);
app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
    fs.readFile(__dirname + '/public/control.html', function (err, data) {
        if (err) {
            res.writeHead(500);
            return res.end('Error occured');
        }
        res.writeHead(200);
        res.write(data);
        res.end();
    });
});


// Functions
var HEX_string = function (num) {
    return Math.floor(num / 16).toString(16).toUpperCase() + (num % 16).toString(16).toUpperCase();
}

var getPosture = function (serialPort, posture, waittime, speed) {
    var FWD = ctrls.swing, BCK = -ctrls.swing, UPP = ctrls.raise,
        DWN = 0, CTR = 0;

    var POSTURES = [
            [// 0
                CTR, DWN,
                CTR, DWN,
                CTR, DWN,
                CTR, DWN,
                CTR, DWN,
                CTR, DWN
            ],
            [// 1
                FWD, DWN,
                BCK, DWN,
                FWD, DWN,
                BCK, DWN,
                FWD, DWN,
                BCK, DWN
            ],
            [// 2
                BCK, DWN,
                FWD, DWN,
                BCK, DWN,
                FWD, DWN,
                BCK, DWN,
                FWD, DWN
            ],
            [// 3
                CTR, UPP,
                CTR, DWN,
                CTR, UPP,
                CTR, DWN,
                CTR, UPP,
                CTR, DWN
            ],
            [// 4
                CTR, DWN,
                CTR, UPP,
                CTR, DWN,
                CTR, UPP,
                CTR, DWN,
                CTR, UPP
            ],
            [// 5
                FWD, DWN,
                BCK, DWN,
                FWD, DWN,
                FWD, DWN,
                BCK, DWN,
                FWD, DWN
            ],
            [// 6
                BCK, DWN,
                FWD, DWN,
                BCK, DWN,
                BCK, DWN,
                FWD, DWN,
                BCK, DWN
            ],
        ];

    serialPort.write(makeControlSignal(waittime, speed, POSTURES[posture])
        , function (err, results) {
    if (err) {
        console.log('err ' + err);
    }
    console.log('posture: ' + posture);
    });
}

function makeControlSignal (waittime, speed, angles) {
  // Globals:
  // CENTER, motorMap, motorSigns, MOTORS

    var controlSignal = new Buffer([
        0xFD, 0x1A,/* data length */
        0x06,/* command */
        0x30,/* time to wait (per 15 ms) */
        0x01,/* speed 1 to 15 */
        CENTER, CENTER, 0,
        CENTER, CENTER, 0,
        CENTER, CENTER, 0, 0, 0,
        CENTER, CENTER, 0,
        CENTER, CENTER, 0,
        CENTER, CENTER, 0,
        0xFE
    ]);

  controlSignal[3] = waittime;
  controlSignal[4] = speed;

  // Exception process
  for (var i = 0; i < MOTORS; i++) {
    if (angles[i] < -MOTOR_MAX_ANGLE) {
      angles[i] = -MOTOR_MAX_ANGLE;
    } else if (angles[i] > MOTOR_MAX_ANGLE) {
      angles[i] = MOTOR_MAX_ANGLE;
    }
    controlSignal[motorMap[i]] = (CENTER + motorSigns[i] * (angles[i] + motorOffset[i]));
  }
  return controlSignal;
}

// Serial port setup
var serialPort = new SerialPort(
    SERIAL_PORT,
    {baudrate: BAUDRATE}
);

// Open serial port and start main process
serialPort.on("open", function () {
    console.log("Serialport " + SERIAL_PORT + " opened");
    serialPort.on('data', function(data) {
        // When serial port received some message from the robot
        for (var i = 0; i < data.length; i++) {
            util.print(HEX_string(data.readUInt8(i)) + ' ');
        }
    });

    // Run Web server and socket.io connection
    server.listen(app.get('port'));
    console.log('Server started on: ' + local_ip + ':' + app.get('port'));

    // Control events
    io.of('/control').on('connection', function (socket) {
        socket.on('data', function (received_data) {
            // Process executed when received data socket
            if (ctrls.data.direction != received_data.direction) {
                // Change direction
                switch (received_data.direction) {
                    case 'n':
                        break;
                    case 'up':
                        ctrls.queue = [2, 3, 1, 4];
                        ctrls.initflg = true;
                        break;
                    case 'down':
                        ctrls.queue = [1, 3, 2, 4];
                        ctrls.initflg = true;
                        break;
                    case 'right':
                        ctrls.queue = [6, 3, 5, 4];
                        ctrls.initflg = true;
                        break;
                    case 'left':
                        ctrls.queue = [5, 3, 6, 4];
                        ctrls.initflg = true;
                        break;
                }
                ctrls.data.direction = received_data.direction;
            }

            if (ctrls.data.speed != received_data.speed) {
                // Change speed parameters
                var dtmax = speed_settings[received_data.speed].tmax - ctrls.tmax;
                ctrls.tmax = speed_settings[received_data.speed].tmax;
                ctrls.speed = speed_settings[received_data.speed].speed;
                ctrls.tcnt += dtmax;
                if (ctrls.tcnt <= 0) {
                    ctrls.tcnt = 0;
                } else if (ctrls.tcnt > ctrls.tmax) {
                    ctrls.tcnt = ctrls.tmax;
                }
            }

            if (ctrls.data.raise != received_data.raise) {
                ctrls.data.raise = received_data.raise;
            }
            if (ctrls.data.swing != received_data.swing) {
                ctrls.data.swing = received_data.swing;
            }

        });

        socket.on('power', function (data) {
            console.log('shutting down');
            if (data == 'POWEROFF') {
                spawn('sudo', ['shutdown', '-h', 'now']);
            }
        });

        var vlc;
        socket.on('sound', function (data) {
            if (data == 'play' && !vlc) {
                vlc = spawn('cvlc', ['-I', 'rc', __dirname + musicfile]);
            } else if (data == 'stop') {
                if (vlc) {
                    vlc.stdin.end('quit');
                    vlc = undefined;
                }
            }
        });

        var aplay, aqutalk;
        socket.on('talk', function (data) {
            if (!aplay && !aqutalk) {
                aqutalk = spawn('/opt/aquestalkpi/AquesTalkPi', ["'" + data.msg + "'"]);
                aplay = spawn('aplay');
                aqutalk.stdout.on('data', function (data) {
                    aplay.stdin.write(data);
                });
                aqutalk.stdout.on('end', function () {
                    aplay.stdin.end();
                    aplay = aqutalk = undefined;
                    socket.emit('talk-over', data.handler);
                });
            }
        });
    });

    var waittime = 1;
    var SPEED = 15, TIME_INTERVAL = 0.1;
    var pos = 0;
    // var queue = [3, 5, 4, 6]; // Turning
    Repeat(function() {
        if (ctrls.data.direction == 'n') {
            // Pause
            return;
        }
        // Main process to move motors
        if (ctrls.tcnt == 0) {
            // Shot a command
            if (ctrls.initflg) {
                // Initialize the position
                getPosture(serialPort, 0, waittime, ctrls.speed);
                ctrls.initflg = false;
                ctrls.qindex = 0;
                ctrls.tcnt = ctrls.tmax;
                if (ctrls.data.direction == 'i') {
                    // Wait for control socket
                    ctrls.data.direction = 'n';
                }
            } else {
                // Make posture according to the queue
                getPosture(serialPort, ctrls.queue[ctrls.qindex++], waittime, ctrls.speed);
                if (ctrls.qindex >= ctrls.queue.length) {
                    ctrls.qindex = 0;
                }
                ctrls.tcnt = ctrls.tmax;
            }

        } else {
            ctrls.tcnt--;
        }
    }).every(TIME_INTERVAL, 'sec').during(function() {
        return 1;
    }).start.now();

});
