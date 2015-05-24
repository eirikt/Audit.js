var _fun = require("./fun"),
    rq = require("rq-essentials"),
    curry = require("./fun").curry,

// TODO: Move to 'app.config.js'?
    doLog = exports.doLog = true,
    doNotLog = exports.doNotLog = false,


// TODO: Move to 'app.config.js'?
///////////////////////////////////////////////////////////////////////////////
// Some curried Express requestors
// Just add response object, then use them in RQ pipelines
///////////////////////////////////////////////////////////////////////////////

    _send200OkResponse = exports.send200OkResponse = curry(rq.dispatchResponseStatusCode, doLog, 200),
    _send200OkResponseWithArgumentAsBody = exports.send200OkResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 200),
    _send200CreatedResponseWithBodyConsistingOf = exports.send200CreatedResponseWithBodyConsistingOf = curry(rq.dispatchResponseWithJsonBody, doLog, 200),
    _send201CreatedResponseWithArgumentAsBody = exports.send201CreatedResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 201),
    _send201CreatedResponseWithBodyConsistingOf = exports.send201CreatedResponseWithBodyConsistingOf = curry(rq.dispatchResponseWithJsonBody, doLog, 201),
    _send202AcceptedResponse = exports.send202AcceptedResponse = curry(rq.dispatchResponseStatusCode, doLog, 202),
    _send202AcceptedResponseWithArgumentAsBody = exports.send202AcceptedResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 202),
    _send205ResetContentResponse = exports.send205ResetContentResponse = curry(rq.dispatchResponseStatusCode, doLog, 205),
    _send400BadRequestResponseWithArgumentAsBody = exports.send400BadRequestResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 400),
    _send403ForbiddenResponseWithArgumentAsBody = exports.send403ForbiddenResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 403),
    _send404NotFoundResponseWithArgumentAsBody = exports.send404NotFoundResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 404),
    _send405MethodNotAllowedResponseWithArgumentAsBody = exports.send405MethodNotAllowedResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doLog, 405),
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
     * Meant for serialized/over-the-wire-sent data ...
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
     * Meant for runtime objects ...
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

// TODO: Revise this one for 'RQ.js' ...
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
        },


///////////////////////////////////////////////////////////////////////////////
// Predicated
// TODO: Find some decent third-party predicate lib ...
///////////////////////////////////////////////////////////////////////////////

    _predicates = exports.predicates = {
        lessThanOne: function (arg) {
            'use strict';
            return arg < 1;
        }
    };
