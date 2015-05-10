/* global JSON:false */
var _events = require('events'),
    _socketio = require("./socketio.config"),


///////////////////////////////////////////////////////////////////////////////
// Common global event hub
///////////////////////////////////////////////////////////////////////////////

    _serverSidePublisher = exports.eventHub = new _events.EventEmitter(),
    _clientSidePublisher = _socketio.serverPush,

    _isArray = Array.isArray,
    _slice = Array.prototype.slice,

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

    _publish = exports.publish =
        function () {
            'use strict';
            var messageArgs = _slice.call(arguments, 0),
                messageId = messageArgs[0],
                messageArguments = _slice.call(arguments, 1);

            // TODO: Limited to 3 event message arguments ... Rewrite using apply with arguments, struggling to make that work :-\
            switch (messageArguments.length) {
                case 0:
                    _serverSidePublisher.emit(messageId);
                    _clientSidePublisher.emit(messageId);
                    break;
                case 1:
                    _serverSidePublisher.emit(messageId, messageArguments[0]);
                    _clientSidePublisher.emit(messageId, messageArguments[0]);
                    break;
                case 2:
                    _serverSidePublisher.emit(messageId, messageArguments[0], messageArguments[1]);
                    _clientSidePublisher.emit(messageId, messageArguments[0], messageArguments[1]);
                    break;
                case 3:
                    _serverSidePublisher.emit(messageId, messageArguments[0], messageArguments[1], messageArguments[2]);
                    _clientSidePublisher.emit(messageId, messageArguments[0], messageArguments[1], messageArguments[2]);
                    break;
                default:
                    break;
            }

            console.log('\'' + messageId + '\' published (both server-side and client-side) ...');
        },

    _publishClientSide = exports.publishClientSide =
        function (messageName, messageBody) {
            'use strict';
            //var messageArgs = Array.prototype.slice.call(arguments, 1);
            io.emit(arguments);
            console.log('\'' + messageName + '\' published (client-side only) ...');
        },

    _publishServerSide = exports.publishServerSide =
        function (messageName, messageBody) {
            'use strict';
            //var messageArgs = Array.prototype.slice.call(arguments, 1);
            _serverSidePublisher.emit(arguments);
            console.log('\'' + messageName + '\' published (server-side only) ...');
        },


///////////////////////////////////////////////////////////////////////////////
// Generic helper functions
///////////////////////////////////////////////////////////////////////////////

    /** @returns {string} The percentage with the given precision */
    _getPercentage = exports.getPercentage =
        function (number, totalNumber, precision) {
            'use strict';
            return (number / totalNumber * 100).toFixed(precision || 1);
        },


    /**
     * Invoke the given callback function only when the iteration number is a natural number ratio of the total iteration number.
     *
     * @param numberOfThrottledEvents number of events to let through
     * @param iterationNo current event number
     * @param totalIterationNo total number of events expected
     * @param callback function with progress percentage value as parameter
     */
    _throttleEvents = exports.throttleEvents =
        function (numberOfThrottledEvents, iterationNo, totalIterationNo, callback) {
            'use strict';
            var skippingInterval,
                doEmit,
                progressValueProgressInPercent;

            if (numberOfThrottledEvents <= 100 && totalIterationNo <= numberOfThrottledEvents) {
                callback(iterationNo);

            } else {
                skippingInterval = Math.floor(totalIterationNo / numberOfThrottledEvents);
                doEmit = iterationNo % skippingInterval === 0;
            }

            if (doEmit && callback) {
                if (numberOfThrottledEvents > 100) {
                    progressValueProgressInPercent = _getPercentage(iterationNo, totalIterationNo);
                } else {
                    progressValueProgressInPercent = Math.ceil(iterationNo / totalIterationNo * 100);
                }
                callback(progressValueProgressInPercent);
            }
        },


    _handleError = exports.handleError =
        function (err, options) {
            'use strict';

            if (!err) {
                return false;
            }

            var hasErrorMessage = err.message;

            if (hasErrorMessage) {
                console.warn(err.message);
            } else {
                console.warn(err);
            }

            if (!options) {
                throw new Error(err);
            }

            if (options && options.response) {
                if (hasErrorMessage) {
                    options.response.status(500).send({ error: err.message });
                } else {
                    options.response.status(500).send({ error: err });
                }
                return false;
            }

            if (options && options.deferred) {
                if (hasErrorMessage) {
                    options.deferred.reject(err.message);
                } else {
                    options.deferred.reject(err);
                }
            }
            return true;
        };

