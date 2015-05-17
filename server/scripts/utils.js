var //_events = require('events'),
    //_socketio = require("./socketio.config"),
    _fun = require("./fun"),
    rq = require("rq-essentials"),
    curry = require("./fun").curry,

// TODO: Move to 'app.config.js'?
    doLog = exports.doLog = true,
    doNotLog = exports.doNotLog = false,

//_slice = Array.prototype.slice,
//_isArray = _fun.isArray,

/*
 ///////////////////////////////////////////////////////////////////////////////
 // Common global event hub
 ///////////////////////////////////////////////////////////////////////////////

 _serverSidePublisher = new _events.EventEmitter(),
 _clientSidePublisher = _socketio.serverPush,

 _resetMessenger = exports.resetMessenger =
 function () {
 'use strict';
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

 _publish = exports.publish =
 function () {
 'use strict';
 var messageArgs = _slice.call(arguments, 0),
 messageId = messageArgs[0],
 messageArguments = _slice.call(arguments, 1),
 argumentsLogMessage = null;

 // TODO: Limited to 3 event message arguments ... Rewrite using apply with arguments, struggling to make that work :-\
 switch (messageArguments.length) {
 case 0:
 _serverSidePublisher.emit(messageId);
 _clientSidePublisher.emit(messageId);
 break;
 case 1:
 _serverSidePublisher.emit(messageId, messageArguments[0]);
 _clientSidePublisher.emit(messageId, messageArguments[0]);
 argumentsLogMessage = JSON.stringify(messageArguments[0]);
 break;
 case 2:
 _serverSidePublisher.emit(messageId, messageArguments[0], messageArguments[1]);
 _clientSidePublisher.emit(messageId, messageArguments[0], messageArguments[1]);
 argumentsLogMessage = JSON.stringify(messageArguments[0] + ', ' + messageArguments[1]);
 break;
 case 3:
 _serverSidePublisher.emit(messageId, messageArguments[0], messageArguments[1], messageArguments[2]);
 _clientSidePublisher.emit(messageId, messageArguments[0], messageArguments[1], messageArguments[2]);
 argumentsLogMessage = JSON.stringify(messageArguments[0] + ', ' + messageArguments[1] + ', ' + messageArguments[2]);
 break;
 default:
 break;
 }

 console.log('\'' + messageId + '(' + argumentsLogMessage + ')\' published (both server-side and client-side) ...');
 },

 _publishClientSide = exports.publishClientSide =
 function (messageName, messageBody) {
 'use strict';
 //var messageArgs = Array.prototype.slice.call(arguments, 1);
 _clientSidePublisher.emit(arguments);
 console.log('\'' + messageName + '\' published (client-side only) ...');
 },

 _publishServerSide = exports.publishServerSide =
 function (messageName, messageBody) {
 'use strict';
 //var messageArgs = Array.prototype.slice.call(arguments, 1);
 _serverSidePublisher.emit(arguments);
 console.log('\'' + messageName + '\' published (server-side only) ...');
 },

 _rqPublish = exports.rqPublish =
 function (messageId) {
 'use strict';
 return function requestor(callback, messageArguments) {
 _publish(messageId, messageArguments);
 callback(messageArguments, undefined);
 };
 },
 */


// TODO: Move to 'app.config.js'?
///////////////////////////////////////////////////////////////////////////////
// Some curried Express requestors
// Just add response object, then use them in RQ pipelines
///////////////////////////////////////////////////////////////////////////////

    _send200OkResponse = exports.send200OkResponse = curry(rq.dispatchResponseStatusCode, doLog, 200),
    _send200OkResponseWithArgAsBody = exports.send200OkResponseWithArgAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 200),
    _send201CreatedResponseWithArgAsBody = exports.send201CreatedResponseWithArgAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 201),
    _send201CreatedResponse = exports.send201CreatedResponse = curry(rq.dispatchResponseWithJsonBody, doLog, 201),
    _send202AcceptedResponse = exports.send202AcceptedResponse = curry(rq.dispatchResponseStatusCode, doLog, 202),
    _send202AcceptedResponseWithArgAsBody = exports.send202AcceptedResponseWithArgAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 202),
    _send205ResetContentResponse = exports.send205ResetContentResponse = curry(rq.dispatchResponseStatusCode, doLog, 205),
    _send400BadRequestResponseWithArgAsBody = exports.send400BadRequestResponseWithArgAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 400),
    _send403ForbiddenResponseWithArgAsBody = exports.send403ForbiddenResponseWithArgAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 403),
    _send404NotFoundResponseWithArgAsBody = exports.send404NotFoundResponseWithArgAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 404),
    _send405MethodNotAllowedResponseWithArgAsBody = exports.send405MethodNotAllowedResponseWithArgAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 405),
    _send500InternalServerErrorResponse = exports.send500InternalServerErrorResponse = curry(rq.dispatchResponseStatusCode, doLog, 500),


///////////////////////////////////////////////////////////////////////////////
// Generic curry-friendly helper functions
///////////////////////////////////////////////////////////////////////////////
    _notHttpMethod = exports.notHttpMethod =
        function (httpMethod, request) {
            'use strict';
            return function () {
                return request.method !== httpMethod;
            };
        },

    /**
     * Meant for over-the-wire data ...
     */
    _isMissing = exports.isMissing =
        function (valueOrArray) {
            'use strict';
            return function () {
                if (!valueOrArray && valueOrArray !== 0) {
                    return true;
                }
                return !!(_fun.isString(valueOrArray) && valueOrArray.trim() === '');
            };
        },

    /**
     * Meant for objects ...
     */
    _isEmpty = exports.isEmpty =
        function (objectOrArray) {
            'use strict';
            return function () {
                if (_fun.isArray(objectOrArray)) {
                    return objectOrArray.length < 1;
                }
                if (_fun.isObject(objectOrArray)) {
                    return Object.keys(objectOrArray).length === 0;
                }
                return _isMissing(objectOrArray)();
            };
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

// TODO: Revise this one for RQ ...
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
