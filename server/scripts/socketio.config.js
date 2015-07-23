var httpServer = require('./express.config.js').httpServer,

// Establish Server Push / Socket.IO manager
    socketio = require('socket.io'),
    serverPush = exports.serverPush = exports.clientSidePublisher = socketio.listen(httpServer),

    utils = require('./utils'),
    app = require('./app.config'),

// User connection counter.
    userCounter = 0;


serverPush.on('connection', function (socket) {
    'use strict';
    userCounter += 1;
    console.log(app.config.logPreamble() + 'Socket.IO: User connected (now ' + userCounter + ' connected)');
    socket.on('disconnect', function () {
        userCounter -= 1;
        console.log(app.config.logPreamble() + 'Socket.IO: User disconnected (now ' + userCounter + ' connected)');
    });
});


setTimeout(function () {
    'use strict';
    console.log(app.config.logPreamble() + 'Socket.IO server listening on port %d', require('./express.config.js').port);
}, 1000);


// Emitting of current number of users every 10 seconds
setInterval(function () {
    'use strict';
    console.log(app.config.logPreamble() + 'Socket.IO: Number of connected users: ' + userCounter);
    serverPush.emit('number-of-connections', userCounter);
}, 10000);
