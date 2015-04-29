var mongodb = require("./mongodb.config"),
    mongoose = mongodb.mongoose,

    serverPush = require("./socketio.config").serverPush,

    eventSourcing = require("./mongoose.event-sourcing"),
    library = require("./library-model"),


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

    _getCqrsStatus = exports.getCqrsStatus = function () {
        'use strict';
        return _useCQRS;
    },

    /**
     * For Testing
     * @private
     */
    _setCqrsStatus = exports._setCqrsStatus = function (newCqrsStatus) {
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
     * Resource properties outgoing : Boolean value indicating whether CQRS is activated on the server or not
     * Push messages                : -
     */
    _status = exports.status =
        function (request, response) {
            'use strict';
            if (request.method !== 'GET') {
                return response.sendStatus(405);
            }
            response.status(200).send(_useCQRS);
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
     * Resource properties outgoing : -
     * Push messages                : 'cqrs' (CQRS status)
     */
    _toggle = exports.toggle =
        function (request, response) {
            'use strict';
            if (request.method !== 'POST') {
                return response.sendStatus(405);
            }
            response.sendStatus(202);
            if (_useCQRS) {
                console.warn('Bypassing application store - will use event store only!');
            } else {
                console.log('Activating application store ...');
            }
            _useCQRS = !_useCQRS;
            serverPush.emit('cqrs', _useCQRS);
            if (_useCQRS) {
                // TODO: Get rid of library coupling
                eventSourcing.replayAllStateChanges(library.Book, serverPush, mongodb.db);
            }
        };
