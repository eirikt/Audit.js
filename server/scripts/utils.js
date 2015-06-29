var __ = require('underscore'),
    moment = require('moment'),
    _fun = require('./fun'),
    rq = require('RQ-essentials'),
    curry = require('./fun').curry,

// TODO: Move to 'app.config.js'?
    doLog = exports.doLog = true,
    doNotLog = exports.doNotLog = false,


///////////////////////////////////////////////////////////////////////////////
// NB! This file is a big TODO!
// It acts as flypaper for unsorted-out stuff ... which is not a problem in itself, but
///////////////////////////////////////////////////////////////////////////////


    /**
     * A simple timestamp in brackets, suitable for log line preambles.
     * @returns {String} Simple date-in-square-brackets string
     */
    _logPreamble = exports.logPreamble = function () {
        'use strict';
        return '[' + moment().format('YYYY-MM-DD HH:mm:ss') + '] ';
    },


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
    _send500NotImplementedServerErrorResponse = exports.send501NotImplementedServerErrorResponse = curry(rq.dispatchResponseStatusCode, doLog, 501),


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
// Predicate factories / higer-order functions
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


///////////////////////////////////////////////////////////////////////////////
// Higher-order stuff
// TODO: Find some decent third-party lib for these things ...
///////////////////////////////////////////////////////////////////////////////

    /** Higher-order negation */
    _not = exports.not =
        function (condition) {
            'use strict';
            return function (args) {
                var executedCondition = _fun.isFunction(condition) ? condition.call(this, args) : condition;
                return !executedCondition;
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
// Predicates ...
// TODO: Find some decent third-party predicate lib ...
///////////////////////////////////////////////////////////////////////////////

    _predicates = exports.predicates = {
        lessThanOne: function (arg) {
            'use strict';
            return arg < 1;
        }
    };
