var events = require('events'),
    socketio = require('./socketio.config'),
    utils = require('./utils'),
    app = require('./app.config'),
    serverSidePublisher = new events.EventEmitter(),
    clientSidePublisher = socketio.serverPush,

    resetMessenger = exports.resetMessenger =
        function () {
            'use strict';
            serverSidePublisher.removeAllListeners('cqrs');
            console.log(app.config.logPreamble() + 'All \'cqrs\' listeners removed ...');

            serverSidePublisher.removeAllListeners('all-book-statechangeevents-created');
            console.log(app.config.logPreamble() + 'All \'all-book-statechangeevents-created\' listeners removed ...');

            serverSidePublisher.removeAllListeners('all-visit-statechangeevents-created');
            console.log(app.config.logPreamble() + 'All \'all-visit-statechangeevents-created\' listeners removed ...');

            serverSidePublisher.removeAllListeners('replay-all-events');
            console.log(app.config.logPreamble() + 'All \'replay-all-events\' listeners removed ...');

            serverSidePublisher.removeAllListeners('book-updated');
            console.log(app.config.logPreamble() + 'All \'book-updated\' listeners removed ...');

            serverSidePublisher.removeAllListeners('book-removed');
            console.log(app.config.logPreamble() + 'All \'book-removed\' listeners removed ...');
        };
