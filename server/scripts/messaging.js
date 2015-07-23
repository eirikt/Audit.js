/* global JSON:false */

///////////////////////////////////////////////////////////////////////////////
// Common global event hub
///////////////////////////////////////////////////////////////////////////////

var events = require('events'),
    __ = require('underscore'),

    socketio = require('./socketio.config'),
    utils = require('./utils'),
    app = require('./app.config'),

    slice = Array.prototype.slice,
    isArray = Array.isArray,
    serverSidePublisher = new events.EventEmitter(),
    clientSidePublisher = socketio.serverPush,


// Registering of server-side listener subscriptions
    subscribe = exports.subscribe =
        function (messageNames, handler) {
            'use strict';
            if (!isArray(messageNames)) {
                messageNames = [messageNames];
            }
            messageNames.forEach(function (messageName) {
                console.log(app.config.logPreamble() + '\'' + messageName + '\' listener registered ... (' + typeof handler + ')');
                serverSidePublisher.on(messageName, handler);
            });
        },


// Registering of server-side listener subscriptions, one message only
    subscribeOnce = exports.subscribeOnce =
        function (messageNames, handler) {
            'use strict';
            if (!isArray(messageNames)) {
                messageNames = [messageNames];
            }
            messageNames.forEach(function (messageName) {
                console.log(app.config.logPreamble() + '\'' + messageName + '\' listener registered for one action only ...');
                serverSidePublisher.once(messageName, handler);
            });
        },


    unSubcribeServerSide = exports.unSubcribeServerSide =
        function (messageName) {
            'use strict';
            console.log(app.config.logPreamble() + 'All \'' + messageName + '\' listeners removed ...');
            serverSidePublisher.removeAllListeners(messageName);
        },


// TODO: Refactor stuff below, more DRY please
    publishAll = exports.publishAll =
        function () {
            'use strict';
            var messageArgs = slice.call(arguments, 0),
                messageId = messageArgs[0],
                messageArguments = slice.call(arguments, 1),
                argumentsLogMessage = null,

            // Extra service: when wrapped as an RQ requestor, an undefined argument may be added, so ...
                filteredMessageArguments = messageArguments.filter(function (element) {
                    return !__.isUndefined(element);
                });

            // TODO: Limited to 3 event message arguments ... Rewrite using apply with arguments, struggling to make that work :-\
            switch (filteredMessageArguments.length) {
                case 0:
                    console.log(app.config.logPreamble() + '\'' + messageId + '\' published (both server-side and client-side) ...');
                    serverSidePublisher.emit(messageId);
                    clientSidePublisher.emit(messageId);
                    break;
                case 1:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    serverSidePublisher.emit(messageId, filteredMessageArguments[0]);
                    clientSidePublisher.emit(messageId, filteredMessageArguments[0]);
                    break;
                case 2:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    serverSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1]);
                    clientSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1]);
                    break;
                case 3:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1] + ', ' + filteredMessageArguments[2]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    serverSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1], filteredMessageArguments[2]);
                    clientSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1], filteredMessageArguments[2]);
                    break;
                default:
                    throw new Error('"publishAll" helper function only supports 3 argument as of now ...');
            }
            // Extra service: when wrapped as an RQ requestor, return last argument, being the requestor 'args'
            return messageArguments[messageArguments.length - 1];
        },


    publishClientSide = exports.publishClientSide =
        //function (messageName, messageBody) {
        function () {
            'use strict';
            //_clientSidePublisher.emit(arguments);
            //console.log('\'' + messageName + '\' published (client-side only) ...');
            var messageArgs = slice.call(arguments, 0),
                messageId = messageArgs[0],
                messageArguments = slice.call(arguments, 1),
                argumentsLogMessage = null,

            // Extra service: when wrapped as an RQ requestor, an undefined argument may be added, so ...
                filteredMessageArguments = messageArguments.filter(function (element) {
                    return !__.isUndefined(element);
                });

            // TODO: Limited to 3 event message arguments ... Rewrite using apply with arguments, struggling to make that work :-\
            switch (filteredMessageArguments.length) {
                case 0:
                    console.log(app.config.logPreamble() + '\'' + messageId + '\' published (both server-side and client-side) ...');
                    clientSidePublisher.emit(messageId);
                    break;
                case 1:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    clientSidePublisher.emit(messageId, filteredMessageArguments[0]);
                    break;
                case 2:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    clientSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1]);
                    break;
                case 3:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1] + ', ' + filteredMessageArguments[2]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    clientSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1], filteredMessageArguments[2]);
                    break;
                default:
                    throw new Error('\'publishClientSide\' helper function only supports 3 argument as of now ...');
            }
            // Extra service: when wrapped as an RQ requestor, return last argument, being the requestor 'args'
            return messageArguments[messageArguments.length - 1];
        },


    publishServerSide = exports.publishServerSide =
        //function (messageName, messageBody) {
        function () {
            'use strict';
            //_serverSidePublisher.emit(arguments);
            //console.log('\'' + messageName + '\' published (server-side only) ...');
            var messageArgs = slice.call(arguments, 0),
                messageId = messageArgs[0],
                messageArguments = slice.call(arguments, 1),
                argumentsLogMessage = null,

            // Extra service: when wrapped as an RQ requestor, an undefined argument may be added, so ...
                filteredMessageArguments = messageArguments.filter(function (element) {
                    return !__.isUndefined(element);
                });

            // TODO: Limited to 3 event message arguments ... Rewrite using apply with arguments, struggling to make that work :-\
            switch (filteredMessageArguments.length) {
                case 0:
                    console.log(app.config.logPreamble() + '\'' + messageId + '\' published (both server-side and client-side) ...');
                    serverSidePublisher.emit(messageId);
                    break;
                case 1:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    serverSidePublisher.emit(messageId, filteredMessageArguments[0]);
                    break;
                case 2:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    serverSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1]);
                    break;
                case 3:
                    argumentsLogMessage = JSON.stringify(filteredMessageArguments[0] + ', ' + filteredMessageArguments[1] + ', ' + filteredMessageArguments[2]);
                    console.log(app.config.logPreamble() + '\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
                    serverSidePublisher.emit(messageId, filteredMessageArguments[0], filteredMessageArguments[1], filteredMessageArguments[2]);
                    break;
                default:
                    throw new Error('\'publishServerSide\' helper function only supports 3 argument as of now ...');
            }
            // Extra service: when wrapped as an RQ requestor, return last argument, being the requestor 'args'
            return messageArguments[messageArguments.length - 1];
        };
