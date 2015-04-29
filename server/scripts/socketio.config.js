var httpServer = require('./express.config').httpServer,

// Establish Server Push / Socket.IO manager
    serverPush = exports.serverPush = require('socket.io').listen(httpServer);


// User connection counter.
var userCounter = 0;

serverPush.on('connection', function (socket) {
    'use strict';
    console.log('Socket.io: User connected ...');
    userCounter += 1;
    socket.on('disconnect', function () {
        console.log('Socket.io: User disconnected!');
        userCounter -= 1;
    });
});


// Emitting of current number of users every 10 seconds
setInterval(function () {
    'use strict';
    console.log('Number of connected users: ' + userCounter);
    serverPush.emit('number-of-connections', userCounter);
}, 10000);
