/* global JSON:false */
var __ = require('underscore'),
    moment = require('moment'),
    RQ = require('async-rq'),
    rq = require('RQ-essentials'),


///////////////////////////////////////////////////////////////////////////////
// NB! This file is a big TODO!
// It acts as flypaper for unsorted-out stuff ... which is not a problem in itself, but
///////////////////////////////////////////////////////////////////////////////


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
// Some higher-order predicates ...
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
