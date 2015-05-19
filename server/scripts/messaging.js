/* global JSON:false */

///////////////////////////////////////////////////////////////////////////////
// Common global event hub
///////////////////////////////////////////////////////////////////////////////

var _events = require('events'),
    __ = require('underscore'),

    _socketio = require("./socketio.config"),
    _fun = require("./fun"),


    _slice = Array.prototype.slice,
    _isArray = _fun.isArray,


    _serverSidePublisher = new _events.EventEmitter(),
    _clientSidePublisher = _socketio.serverPush,


// TODO: Move to Library specific location => 'library-messaging.js'
    _resetMessenger = exports.resetMessenger =
        function () {
            'use strict';
            _serverSidePublisher.removeAllListeners('cqrs');
            console.log('All \'cqrs\' listeners removed ...');

            _serverSidePublisher.removeAllListeners('all-statechangeevents-created');
            console.log('All \'all-statechangeevents-created\' listeners removed ...');

            _serverSidePublisher.removeAllListeners('replay-all-events');
            console.log('All \'replay-all-events\' listeners removed ...');

            _serverSidePublisher.removeAllListeners('book-updated');
            console.log('All \'book-updated\' listeners removed ...');

            _serverSidePublisher.removeAllListeners('book-removed');
            console.log('All \'book-removed\' listeners removed ...');
        },


// Registering of server-side listener subscriptions
    _subscribe = exports.subscribe =
        function (messageNames, handler) {
            'use strict';
            if (!_isArray(messageNames)) {
                messageNames = [messageNames];
            }
            messageNames.forEach(function (messageName) {
                console.log('\'' + messageName + '\' listener registered ...');
                _serverSidePublisher.on(messageName, handler);
            });
        },


// Registering of server-side listener subscriptions, one message only
    _subscribeOnce = exports.subscribeOnce =
        function (messageNames, handler) {
            'use strict';
            if (!_isArray(messageNames)) {
                messageNames = [messageNames];
            }
            messageNames.forEach(function (messageName) {
                console.log('\'' + messageName + '\' listener registered for one action only ...');
                _serverSidePublisher.once(messageName, handler);
            });
        },


    _unSubcribeServerSide = exports.unSubcribeServerSide =
        function (messageName) {
            'use strict';
            console.log('All \'' + messageName + '\' listeners removed ...');
            _serverSidePublisher.removeAllListeners(messageName);
        },


// TODO: Refactor stuff below
    _publishAll = exports.publishAll =
        function () {
            'use strict';
            var messageArgs = _slice.call(arguments, 0),
                messageId = messageArgs[0],
                messageArguments = _slice.call(arguments, 1),
                argumentsLogMessage = null,

            // Extra service: when wrapped as an RQ requestor, an undefined argument may be added, so ...
                filteredMessageArguments = messageArguments.filter(function (element) {
                    return !__.isUndefined(element);
                });

            // TODO: Limited to 3 event message arguments ... Rewrite using apply with arguments, struggling to make that work :-\
            switch (filteredMessageArguments.length) {
                case 0:
                    console.log('\'' + messageId + '\' published (both server-side and client-side) ...');
                    _serverSidePublisher.emit(messageId);
                    _clientSidePublisher.emit(messageId);
                    break;
                case 1:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _serverSidePublisher.emit(messageId, filteredMessageArguments[0]);
                    _clientSidePublisher.emit(messageId, filteredMessageArguments[0]);
                    break;
                case 2:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _serverSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1]);
                    _clientSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1]);
                    break;
                case 3:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1] + ', ' + filteredMessageArguments[2]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _serverSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1], filteredMessageArguments[2]);
                    _clientSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1], filteredMessageArguments[2]);
                    break;
                default:
                    throw new Error('"publishAll" helper function only supports 3 argument as of now ...');
            }
        },


    _publishClientSide = exports.publishClientSide =
        //function (messageName, messageBody) {
        function () {
            'use strict';
            //_clientSidePublisher.emit(arguments);
            //console.log('\'' + messageName + '\' published (client-side only) ...');
            var messageArgs = _slice.call(arguments, 0),
                messageId = messageArgs[0],
                messageArguments = _slice.call(arguments, 1),
                argumentsLogMessage = null,

            // Extra service: when wrapped as an RQ requestor, an undefined argument may be added, so ...
                filteredMessageArguments = messageArguments.filter(function (element) {
                    return !__.isUndefined(element);
                });

            // TODO: Limited to 3 event message arguments ... Rewrite using apply with arguments, struggling to make that work :-\
            switch (filteredMessageArguments.length) {
                case 0:
                    console.log('\'' + messageId + '\' published (both server-side and client-side) ...');
                    _clientSidePublisher.emit(messageId);
                    break;
                case 1:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _clientSidePublisher.emit(messageId, filteredMessageArguments[0]);
                    break;
                case 2:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _clientSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1]);
                    break;
                case 3:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1] + ', ' + filteredMessageArguments[2]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _clientSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1], filteredMessageArguments[2]);
                    break;
                default:
                    throw new Error('\'publishClientSide\' helper function only supports 3 argument as of now ...');
            }
        },


    _publishServerSide = exports.publishServerSide =
        //function (messageName, messageBody) {
        function () {
            'use strict';
            //_serverSidePublisher.emit(arguments);
            //console.log('\'' + messageName + '\' published (server-side only) ...');
            var messageArgs = _slice.call(arguments, 0),
                messageId = messageArgs[0],
                messageArguments = _slice.call(arguments, 1),
                argumentsLogMessage = null,

            // Extra service: when wrapped as an RQ requestor, an undefined argument may be added, so ...
                filteredMessageArguments = messageArguments.filter(function (element) {
                    return !__.isUndefined(element);
                });

            // TODO: Limited to 3 event message arguments ... Rewrite using apply with arguments, struggling to make that work :-\
            switch (filteredMessageArguments.length) {
                case 0:
                    console.log('\'' + messageId + '\' published (both server-side and client-side) ...');
                    _serverSidePublisher.emit(messageId);
                    break;
                case 1:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _serverSidePublisher.emit(messageId, filteredMessageArguments[0]);
                    break;
                case 2:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _serverSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1]);
                    break;
                case 3:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1] + ', ' + filteredMessageArguments[2]);
                    console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    _serverSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1], filteredMessageArguments[2]);
                    break;
                default:
                    throw new Error('\'publishServerSide\' helper function only supports 3 argument as of now ...');
            }
        };
