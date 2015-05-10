/* jshint -W024 */
var RQ = require("async-rq"),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    rq = require("rq-essentials"),
    then = rq.then,
    go = rq.execute,

    utils = require("./utils"),
    mongodb = require("./mongodb.config"),

    library = require("./library-model"),

    doLog = true, doNotLog = false,


// Internal state

    /**
     * The "CQRS usage" flag.
     *
     * This flag indicates whether to use an <em>application store</em> in addition to the <em>event store</em>, CQRS style.
     * The alternative is to use the event store only, being considerately more ineffective ...
     * But as a demo, <em>using event store only is the default (at the moment), just for fun, being reactive.<em>
     */
    _useCQRS = false,


// Public JavaScript API

    _getCqrsStatus = exports.getCqrsStatus = exports.isCqrsActivated = exports.hasCqrsActivated = exports.cqrs =
        function () {
            'use strict';
            return _useCQRS;
        },

    _isCqrsNotActive = exports.isNotActivated = exports.isCqrsNotActivated =
        function () {
            'use strict';
            return _useCQRS;
        },

    /**
     * For Testing
     * @private
     */
    _setCqrsStatus = exports._setCqrsStatus =
        function (newCqrsStatus) {
            'use strict';
            console.warn("Manipulating CQRS status should be done via 'toggle' REST service call only!");
            _useCQRS = newCqrsStatus;
        },


// Public REST API

    /**
     * Admin API :: Get the "CQRS usage" flag (in-memory)
     *
     * CQRS Query
     *
     * HTTP method                  : GET
     * Resource properties incoming : -
     * Status codes                 : 200 OK
     *                                405 Method Not Allowed (if not a GET request)
     * Resource properties outgoing : Boolean value indicating whether CQRS is activated on the server or not
     * Push messages                : -
     */
    _status = exports.status =
        function (request, response) {
            'use strict';

            var sendOkResponse = rq.dispatchResponseWithScalarBody(doLog, 200, response),
                sendMethodNotAllowedResponse = rq.dispatchResponseWithScalarBody(doLog, 405, response),
                sendInternalServerErrorResponse = rq.dispatchResponseStatusCode(doLog, 500, response),
                notGetMethod = function () {
                    return request.method !== 'GET';
                };

            firstSuccessfulOf([
                sequence([
                    rq.if(notGetMethod),
                    rq.value('URI \'' + request.originalUrl + '\' supports GET requests only'),
                    sendMethodNotAllowedResponse
                ]),
                sequence([
                    rq.value(_useCQRS),
                    sendOkResponse
                ]),
                sendInternalServerErrorResponse
            ])(go);
        },


    /**
     * Admin API :: Switch the "CQRS usage" (in-memory) flag
     * (by creating and sending (posting) a "toggle" object/resource to the server)
     *
     * CQRS Query
     *
     * HTTP method                  : POST
     * Resource properties incoming : -
     * Status codes                 : 202 Accepted
     *                                405 Method Not Allowed (if not a GET request)
     * Resource properties outgoing : -
     * Push messages                : 'cqrs' (CQRS status)
     */
    _toggle = exports.toggle =
        function (request, response) {
            'use strict';
            var sendOkResponse = rq.dispatchResponseStatusCode(doLog, 200, response),
                sendMethodNotAllowedResponse = rq.dispatchResponseWithScalarBody(doLog, 405, response),
                sendInternalServerErrorResponse = rq.dispatchResponseStatusCode(doLog, 500, response),
                notPostMethod = function () {
                    return request.method !== 'POST';
                },
                toggleCqrsStatus = rq.then(function () {
                    _useCQRS = !_useCQRS;
                    if (_useCQRS) {
                        console.log('Activating application store ...');
                    } else {
                        console.warn('Bypassing application store - will use event store only!');
                    }
                }),
                thenPublishNewCqrsStatus = rq.then(function () {
                    utils.publish('cqrs', _useCQRS);
                });

            firstSuccessfulOf([
                sequence([
                    rq.if(notPostMethod),
                    rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    sendMethodNotAllowedResponse
                ]),
                sequence([
                    toggleCqrsStatus,
                    thenPublishNewCqrsStatus,
                    sendOkResponse
                ]),
                sendInternalServerErrorResponse
            ])(go);
        };
