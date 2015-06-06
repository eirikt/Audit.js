/* global JSON:false */
/* jshint -W024 */

var RQ = require('async-rq'),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,

    rq = require('RQ-essentials'),

    curry = require('./fun').curry,
    utils = require('./utils'),
    not = utils.not,
    isHttpMethod = utils.isHttpMethod,

    messenger = require('./messaging'),

    eventSourcing = require('./mongoose.event-sourcing'),
    eventSourcingModel = require('./mongoose.event-sourcing.model'),

    cqrsService = require('./cqrs-service-api'),


///////////////////////////////////////////////////////////////////////////////
// Internal state
///////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////
// Public JavaScript API
///////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////
// Public REST API
// TODO: consider some proper REST API documentation framework
///////////////////////////////////////////////////////////////////////////////

// TODO: consider counting the READs as well as these ...
    /**
     * Admin API :: The total number of state changes in event store
     * (by creating and sending (posting) a "count" object/resource to the server.)
     *
     * CQRS Query / Event store query
     *
     * HTTP method                  : POST
     * Resource properties incoming : -
     * Status codes                 : 200 OK
     *                                405 Method Not Allowed    (not a POST)
     * Resource properties outgoing : "createCount"             (the number of CREATE state change events (HTTP POSTs)
     *                                "updateCount"             (the number of UPDATE state change events (HTTP PUTs)
     *                                "deleteCount"             (the number of DELETE state change events (HTTP DELETEs)
     *                                "totalCount"              (the total number of state change events in event store
     * Event messages emitted       : -
     */
    _allStateChangesCount = exports.count = function (request, response) {
        'use strict';

        var stateChangeCount = curry(rq.mongoose, eventSourcingModel.StateChange, 'count');

        firstSuccessfulOf([
            sequence([
                rq.if(not(isHttpMethod('POST', request))),
                rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]),
            sequence([
                parallel([
                    stateChangeCount({ method: 'CREATE' }),
                    stateChangeCount({ method: 'UPDATE' }),
                    stateChangeCount({ method: 'DELETE' })
                ]),
                rq.then(function (args) {
                    response.status(200).json({
                        createCount: args[0],
                        updateCount: args[1],
                        deleteCount: args[2],
                        totalCount: args[0] + args[1] + args[2]
                    });
                })
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])(rq.run);
    },


    /**
     * Admin API :: All state changes for a particular entity
     *
     * CQRS Query / Event store query
     *
     * HTTP method                  : GET
     * Resource properties incoming : "entityId"
     * Status codes                 : 200 OK
     *                                400 Bad Request           (missing "entityId" parameter)
     *                                405 Method Not Allowed    (not a GET)
     * Resource properties outgoing : Array of 'StateChangeMongooseSchema' objects/resources
     * Event messages emitted       : -
     */
    _allStateChangesByEntityId = exports.stateChanges = function (request, response) {
        'use strict';

        var entityId = request.params.entityId;

        firstSuccessfulOf([
            sequence([
                rq.if(not(isHttpMethod('GET', request))),
                rq.value('URI \'' + request.originalUrl + '\' supports GET requests only'),
                utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.if(utils.isMissing(entityId)),
                rq.value('Mandatory parameter \'entityId\' is missing'),
                utils.send400BadRequestResponseWithArgumentAsBody(response)
            ]),
            sequence([
                eventSourcing.getStateChangesByEntityId(entityId),
                utils.send200OkResponseWithArgumentAsBody(response)
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])(rq.run);
    },


    /**
     * Admin API :: A replay of the entire <em>event store</em> into the <em>application store</em>.
     * (by creating and sending (posting) a "replay" object/resource to the app.)
     *
     * This is an idempotent operation, as already existing domain objects will <em>not</em> be overwritten.
     * For complete re-creation of the application store, purge it before replaying event store.
     *
     * CQRS Query / Application store special
     *
     * HTTP method                  : POST
     * Resource properties incoming : "entityType"              (what kind of state changes to replay)
     * Status codes                 : 202 Accepted
     *                                400 Bad Request           (missing "entityType" parameter)
     *                                403 Forbidden             (resource posted when no application store is in use)
     *                                405 Method Not Allowed    (not a POST)
     * Resource properties outgoing : -
     * Event messages emitted       : "mapreducing-events"      (the total number, start timestamp)
     *                                "event-mapreduced"        (the total number, start timestamp, current progress in percent)
     *                                "all-events-mapreduced"   ()
     *
     *                                "replaying-events"        (the total number, start timestamp)
     *                                "event-replayed"          (the total number, start timestamp, current progress in percent)
     *                                "all-events-replayed"     ()
     */
    _replay = exports.replay = function (request, response) {
        'use strict';
        firstSuccessfulOf([
            sequence([
                rq.if(not(isHttpMethod('POST', request))),
                rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.if(cqrsService.isDisabled),
                rq.value('URI \'' + request.originalUrl + '\' posted when no application store in use (CQRS not activated)'),
                utils.send403ForbiddenResponseWithArgumentAsBody(response)
            ]),
            sequence([
                utils.send202AcceptedResponse(response),
                rq.then(curry(messenger.publishAll, 'replay-all-events'))
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])(rq.run);
    };
