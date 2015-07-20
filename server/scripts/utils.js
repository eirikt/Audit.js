/* global JSON:false */
/* jshint -W024 */

var __ = require('underscore'),
    moment = require('moment'),
    RQ = require('async-rq'),
    rq = require('RQ-essentials'),

    _fun = require('./fun'),
    curry = _fun.curry,


// TODO: Move to 'app.config.js'?
    doLog = exports.doLog = rq.doLog,
    doNotLog = exports.doNotLog = rq.doNotLog,


///////////////////////////////////////////////////////////////////////////////
// NB! This file is a big TODO!
// It acts as flypaper for unsorted-out stuff ... which is not a problem in itself, but
///////////////////////////////////////////////////////////////////////////////


// TODO: Move to 'app.config.js'?
    /**
     * A simple timestamp in brackets, suitable for log line preambles.
     * @returns {String} Simple date-in-square-brackets string
     */
    _logPreamble = exports.logPreamble = function () {
        'use strict';
        return '[' + moment().format('YYYY-MM-DD HH:mm:ss') + '] Audit.js :: ';
    },


///////////////////////////////////////////////////////////////////////////////
// Higher-order stuff
// TODO: Find some decent third-party lib for these things ...
///////////////////////////////////////////////////////////////////////////////

    /** Exhausting higher-order negation */
    _not = exports.not =
        function (condition) {
            'use strict';
            return function (args) {
                while (_fun.isFunction(condition)) {
                    condition = _fun.isFunction(condition) ? condition.call(this, args) : condition;
                }
                return !condition;
            };
        },

    /** Higher-order _.isNumber */
    _isNumber = exports.isNumber =
        function (numberObj) {
            'use strict';
            return function () {
                return __.isNumber(numberObj);
            };
        },


///////////////////////////////////////////////////////////////////////////////
// Predicate factories / higher-order functions
// Generic curry-friendly helper (higher order) functions
///////////////////////////////////////////////////////////////////////////////

    _isHttpMethod = exports.isHttpMethod =
        function (httpMethod, request) {
            'use strict';
            return function () {
                return request.method === httpMethod;
            };
        },

    _isNotHttpMethod = exports.isNotHttpMethod =
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


// TODO: Move to 'app.config.js'? Or to RQ-essentials Express stuff
///////////////////////////////////////////////////////////////////////////////
// Some curried Express requestors
// Just add response object, then use them in RQ pipelines
///////////////////////////////////////////////////////////////////////////////

    _send200OkResponse = exports.send200OkResponse = curry(rq.dispatchResponseStatusCode, doNotLog, 200),
    _send200OkResponseWithArgumentAsBody = exports.send200OkResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doNotLog, 200),
    _send200CreatedResponseWithBodyConsistingOf = exports.send200CreatedResponseWithBodyConsistingOf = curry(rq.dispatchResponseWithJsonBody, doNotLog, 200),
    _send201CreatedResponseWithArgumentAsBody = exports.send201CreatedResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doNotLog, 201),
    _send201CreatedResponseWithBodyConsistingOf = exports.send201CreatedResponseWithBodyConsistingOf = curry(rq.dispatchResponseWithJsonBody, doNotLog, 201),
    _send202AcceptedResponse = exports.send202AcceptedResponse = curry(rq.dispatchResponseStatusCode, doNotLog, 202),
    _send202AcceptedResponseWithArgumentAsBody = exports.send202AcceptedResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doNotLog, 202),
    _send205ResetContentResponse = exports.send205ResetContentResponse = curry(rq.dispatchResponseStatusCode, doNotLog, 205),
    _send400BadRequestResponseWithArgumentAsBody = exports.send400BadRequestResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doNotLog, 400),
    _send403ForbiddenResponseWithArgumentAsBody = exports.send403ForbiddenResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doNotLog, 403),
    _send404NotFoundResponseWithArgumentAsBody = exports.send404NotFoundResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doNotLog, 404),
    _send405MethodNotAllowedResponseWithArgumentAsBody = exports.send405MethodNotAllowedResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doNotLog, 405),
    _send500InternalServerErrorResponse = exports.send500InternalServerErrorResponse = curry(rq.dispatchResponseStatusCode, doNotLog, 500),
    _send500InternalServerErrorResponseWithArgumentAsBody = exports.send500InternalServerErrorResponseWithArgumentAsBody = curry(rq.dispatchResponseWithScalarBody, doNotLog, 500),
    _send501NotImplementedServerErrorResponse = exports.send501NotImplementedServerErrorResponse = curry(rq.dispatchResponseStatusCode, doNotLog, 501),


    _ensureHttpGet = exports.ensureHttpGet =
        function (request, response) {
            'use strict';
            return RQ.sequence([
                rq.if(_not(_isHttpMethod('GET', request))),
                rq.value('URI \'' + request.originalUrl + '\' supports GET requests only'),
                _send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]);
        },
    _ensureHttpPost = exports.ensureHttpPost =
        function (request, response) {
            'use strict';
            return RQ.sequence([
                rq.if(_not(_isHttpMethod('POST', request))),
                rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                _send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]);
        },
    _ensureHttpPut = exports.ensureHttpPut =
        function (request, response) {
            'use strict';
            return RQ.sequence([
                rq.if(_not(_isHttpMethod('PUT', request))),
                rq.value('URI \'' + request.originalUrl + '\' supports PUT requests only'),
                _send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]);
        },
    _ensureHttpDelete = exports.ensureHttpDelete =
        function (request, response) {
            'use strict';
            return RQ.sequence([
                rq.if(_not(_isHttpMethod('DELETE', request))),
                rq.value('URI \'' + request.originalUrl + '\' supports DELETE requests only'),
                _send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]);
        },

    _ensure = exports.ensure =
        function (valueOrArray, request, response) {
            'use strict';
            return RQ.sequence([
                rq.if(_isMissing(valueOrArray)),
                rq.value('Mandatory resource element is missing'),
                _send400BadRequestResponseWithArgumentAsBody(response)
            ]);
        },

    _ensureHttpResourceElement = exports.ensureHttpResourceElement =
        function (resourceElementName, request, response) {
            'use strict';
            return RQ.sequence([
                rq.value(request.params[resourceElementName]),
                rq.if(_isMissing),
                rq.value('Mandatory resource element \'' + resourceElementName + '\' is missing'),
                _send400BadRequestResponseWithArgumentAsBody(response)
            ]);
        },

    _ensureHttpParameter = exports.ensureHttpParameter =
        function (httpParameterName, request, response) {
            'use strict';
            return RQ.sequence([
                rq.value(request.params[httpParameterName]),
                rq.if(_isMissing),
                rq.value('Mandatory HTTP parameter \'' + httpParameterName + '\' is missing'),
                _send400BadRequestResponseWithArgumentAsBody(response)
            ]);
        },

    _ensureNumericHttpParameter = exports.ensureNumericHttpParameter =
        function (httpParameterName, request, response) {
            'use strict';
            return RQ.fallback([
                _ensureHttpParameter(httpParameterName, request, response),
                RQ.sequence([
                    rq.value(request.params[httpParameterName]),
                    rq.if(_not(_isNumber)),
                    rq.value('Mandatory HTTP parameter \'' + httpParameterName + '\' is not a number'),
                    _send400BadRequestResponseWithArgumentAsBody(response)
                ])
            ]);
        },

    _ensureHttpRequestBody = exports.ensureHttpRequestBody =
        function (request, response) {
            'use strict';
            return RQ.fallback([
                RQ.sequence([
                    rq.if(_isMissing(request.body)),
                    rq.value('Mandatory request body is missing'),
                    _send400BadRequestResponseWithArgumentAsBody(response)
                ]),
                RQ.sequence([
                    rq.if(_isEmpty(request.body)),
                    rq.value('Mandatory request body is not valid'),
                    _send400BadRequestResponseWithArgumentAsBody(response)
                ])
            ]);
        },


///////////////////////////////////////////////////////////////////////////////
// Constructor function helpers / Model stuff
// ECMAScript 5 ...
///////////////////////////////////////////////////////////////////////////////

    /** Object.defineProperty config function */
    _mutablePropertyWithDefaultValue = exports.mutablePropertyWithDefaultValue =
        function (defaultValue) {
            'use strict';
            return {
                value: defaultValue,
                writable: true,
                enumerable: true,
                configurable: false
            };
        },

    /** Object.defineProperty config function */
    _immutablePropertyWithDefaultValue = exports.immutablePropertyWithDefaultValue =
        function (defaultValue) {
            'use strict';
            return {
                value: defaultValue,
                writable: false,
                enumerable: true,
                configurable: false
            };
        },

    _arrayToObject = exports.arrayToObject =
        function (arr) {
            'use strict';
            var obj = {};
            arr.forEach(function (element) {
                obj[element] = null;
            });
            return obj;
        },

    /** A constructor function for creating <em>immutable</em> constructor functions. */
    _ImmutableObject = exports.ImmutableObject =
        function () {
            'use strict';
            var self = this,
                arrayModel = arguments[0],
                slice = Array.prototype.slice,
                propertyDescriptors = slice.call(arguments, 1);

            // TODO: Any possibilities including support for missing 'new' when calling constructor functions here?
            //if (!(this instanceof BookModel)) {
            //    return new BookModel(arguments);
            //}
            arrayModel.forEach(function (element, index, array) {
                Object.defineProperty(self, element, _immutablePropertyWithDefaultValue(propertyDescriptors[index]));
            });
            Object.seal(self);
            return this;
        },

    /** A constructor function for creating <em>mutable</em> constructor functions. */
    _MutableObject = exports.MutableObject =
        function () {
            'use strict';
            var self = this,
                arrayModel = arguments[0],
                slice = Array.prototype.slice,
                propertyDescriptors = slice.call(arguments, 1);

            // TODO: Any possibilities including support for missing 'new' when calling constructor functions here?
            //if (!(this instanceof BookModel)) {
            //    return new BookModel(arguments);
            //}
            arrayModel.forEach(function (element, index, array) {
                Object.defineProperty(self, element, _mutablePropertyWithDefaultValue(propertyDescriptors[index]));
            });
            Object.seal(self);
            return this;
        },


///////////////////////////////////////////////////////////////////////////////
// Predicates ...
// TODO: Find some decent third-party predicate lib ...
///////////////////////////////////////////////////////////////////////////////

    _predicates = exports.predicates = {
        equals: function (b) {
            'use strict';
            return function (a) {
                return a === b;
            };
        },
        lessThan: function (b) {
            'use strict';
            return function (a) {
                return a < b;
            };
        },
        greaterThan: function (b) {
            'use strict';
            return function (a) {
                return a > b;
            };
        }
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
     * @param totalIterationNo total number of events expected
     * @param iterationNo current event number
     * @param callback function with progress percentage value as parameter
     */
    _throttleEvents = exports.throttleEvents =
        function (numberOfThrottledEvents, totalIterationNo, iterationNo, callback) {
            'use strict';
            var skippingInterval,
                doEmit,
                progressValueProgressInPercent;

            // TODO: Clean up ...
            //console.log('throttleEvents(numberOfThrottledEvents=' + numberOfThrottledEvents + ', totalIterationNo=' + totalIterationNo + ', iterationNo=' + iterationNo + ')');
            // Ehs: throttleEvents(numberOfThrottledEvents=1000, totalIterationNo=842, iterationNo=839)

            if (numberOfThrottledEvents <= 100 && totalIterationNo <= numberOfThrottledEvents) {
                //console.log('#1');
                callback(iterationNo);

            } else if (totalIterationNo < numberOfThrottledEvents) {
                // If less than 1000 iterations, just use 100
                //console.log('#2');
                numberOfThrottledEvents = 100;
                //skippingInterval = Math.floor(totalIterationNo / numberOfThrottledEvents);
                //doEmit = iterationNo % skippingInterval === 0;
            }

            //} else {
            //console.log('#3');
            skippingInterval = Math.floor(totalIterationNo / numberOfThrottledEvents);
            doEmit = iterationNo % skippingInterval === 0;
            //}

            //console.log('throttleEvents(numberOfThrottledEvents=' + numberOfThrottledEvents + ', totalIterationNo=' + totalIterationNo + ', iterationNo=' + iterationNo + ')');
            //console.log('throttleEvents :: doEmit=' + doEmit + ', skippingInterval=' + skippingInterval);

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
        };
