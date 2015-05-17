/* global JSON:false */
/* jshint -W024 */

var RQ = require('async-rq'),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    rq = require('rq-essentials'),
    then = rq.then,
    go = rq.execute,

    fun = require('./fun'),
    curry = fun.curry,
    utils = require('./utils'),
    mongodb = require('./mongodb.config'),
    messenger = require('./messaging'),

    library = require('./library-model'),


///////////////////////////////////////////////////////////////////////////////
// Internal state
///////////////////////////////////////////////////////////////////////////////

    /**
     * The "CQRS usage" flag.
     *
     * This flag indicates whether to use an <em>application store</em> in addition to the <em>event store</em>, CQRS style.
     * The alternative is to use the event store only, being considerately more ineffective ...
     * But as a demo, <em>using event store only is the default (at the moment), just for fun, being reactive.<em>
     */
    _useCQRS = false,


///////////////////////////////////////////////////////////////////////////////
// Public JavaScript API
///////////////////////////////////////////////////////////////////////////////

    _getCqrsStatus = exports.getCqrsStatus = exports.isCqrsActivated = exports.hasCqrsActivated = exports.cqrs =
        function () {
            'use strict';
            return _useCQRS;
        },

    _isCqrsNotActive = exports.isCqrsNotActivated = exports.isNotActivated =
        function () {
            'use strict';
            return !_getCqrsStatus();
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


///////////////////////////////////////////////////////////////////////////////
// Public REST API
///////////////////////////////////////////////////////////////////////////////

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
     * Event messages emitted       : -
     */
    _status = exports.status =
        function (request, response) {
            'use strict';
            firstSuccessfulOf([
                sequence([
                    rq.if(utils.notHttpMethod('GET', request)),
                    rq.return('URI \'' + request.originalUrl + '\' supports GET requests only'),
                    utils.send405MethodNotAllowedResponseWithArgAsBody(response)
                ]),
                sequence([
                    rq.return(_useCQRS),
                    utils.send200OkResponseWithArgAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(go);
        },


    /**
     * Admin API :: Switch the "CQRS usage" (in-memory) flag
     * (by creating and sending (posting) a "toggle" object/resource to the server)
     *
     * CQRS Command
     *
     * HTTP method                  : POST
     * Resource properties incoming : -
     * Status codes                 : 200 OK
     *                                405 Method Not Allowed (if not a GET request)
     * Resource properties outgoing : Boolean value with the new CQRS status
     * Event messages emitted       : 'cqrs' (CQRS status)
     */
    _toggle = exports.toggle =
        function (request, response) {
            'use strict';

            var toggleCqrsStatus = function () {
                _useCQRS = !_useCQRS;
                if (_useCQRS) {
                    console.log('Activating application store ...');
                } else {
                    console.warn('Bypassing application store - will use event store only!');
                }
            };

            firstSuccessfulOf([
                sequence([
                    rq.if(utils.notHttpMethod('POST', request)),
                    rq.return('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    utils.send405MethodNotAllowedResponseWithArgAsBody(response)
                ]),
                sequence([
                    rq.do(toggleCqrsStatus),
                    rq.value(_getCqrsStatus),
                    utils.send200OkResponseWithArgAsBody(response),
                    rq.then(curry(messenger.publishAll, 'cqrs'))
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(go);
        };
