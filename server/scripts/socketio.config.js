var httpServer = require('./express.config.js').httpServer,

// Establish Server Push / Socket.IO manager
    socketio = require('socket.io'),
    serverPush = exports.serverPush = exports.clientSidePublisher = socketio.listen(httpServer),

    utils = require('./utils'),

// User connection counter.
    userCounter = 0;

serverPush.on('connection', function (socket) {
    'use strict';
    userCounter += 1;
    console.log(utils.logPreamble() + 'Socket.io: User connected (now ' + userCounter + ' connected)');
    socket.on('disconnect', function () {
        userCounter -= 1;
        console.log(utils.logPreamble() + 'Socket.io: User disconnected (now ' + userCounter + ' connected)');
    });
});


// Emitting of current number of users every 10 seconds
setInterval(function () {
    'use strict';
    console.log(utils.logPreamble() + 'Socket.io: Number of connected users: ' + userCounter);
    serverPush.emit('number-of-connections', userCounter);
}, 10000);
