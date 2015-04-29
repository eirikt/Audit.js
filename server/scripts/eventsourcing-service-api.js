var mongodb = require("./mongodb.config"),
    mongoose = mongodb.mongoose,

    RQ = require("async-rq"),
    sequence = RQ.sequence,
    fallback = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,

    rq = require("rq-essentials"),
    then = rq.then,
    go = rq.execute,

    curry = require("./fun").curry,
    error = require("./error"),

    eventSourcing = require("./mongoose.event-sourcing"),
    library = require("./library-model"),

    doLog = true, doNotLog = false,


// Internal state


// Public JavaScript API


// Public REST API
// TODO: consider some proper REST API documentation framework

// TODO: consider counting the READs as well as these ...
    /**
     * Admin API :: The total number of state changes in event store
     * (by creating and sending (posting) a "count" object/resource to the server.)
     *
     * CQRS Query / Event store query
     *
     * HTTP method                  : POST
     * Resource properties incoming : -
     * Status codes                 :
     *                                200 OK
     *                                405 Method Not Allowed    (not a POST)
     * Resource properties outgoing :
     *                                'createCount' : The number of CREATE state change events (HTTP POSTs)
     *                                'updateCount' : The number of UPDATE state change events (HTTP PUTs)
     *                                'deleteCount' : The number of DELETE state change events (HTTP DELETEs)
     *                                'totalCount'  : The total number of state change events in event store
     * Push messages                : -
     */
    _allStateChangesCount = exports.count = function (request, response) {
        'use strict';
        if (request.method !== 'POST') {
            response.sendStatus(405);
            return;
        }
        var stateChangeCount = curry(rq.mongoose, eventSourcing.StateChange, "count"),
            sendInternalServerErrorResponse = rq.dispatchResponseStatusCode(doLog, 500, response);

        fallback([
            sequence([
                parallel([
                    stateChangeCount({ method: "CREATE" }),
                    stateChangeCount({ method: "UPDATE" }),
                    stateChangeCount({ method: "DELETE" })
                ]),
                then(function (args) {
                    response.status(200).send({
                        createCount: args[0],
                        updateCount: args[1],
                        deleteCount: args[2],
                        totalCount: args[0] + args[1] + args[2]
                    });
                })
            ]),
            sendInternalServerErrorResponse
        ])(go);
    },


    /**
     * Admin API :: All state changes for a particular entity
     *
     * CQRS Query / Event store query
     *
     * HTTP method                  : GET
     * Resource properties incoming : -
     * Status codes                 :
     *                                200 OK
     *                                400 Bad Request           (Missing "entityId" parameter)
     *                                405 Method Not Allowed    (Not a GET)
     * Resource properties outgoing : Array of 'StateChangeMongooseSchema' objects/resources
     * Push messages                : -
     */
    _AllStateChangesByEntityId = exports.events = function (request, response) {
        'use strict';
        if (request.method !== 'GET') {
            response.sendStatus(405);
            return;
        }
        var entityId = request.params.entityId,
            sendOkResponse = rq.dispatchResponse(doLog, 200, response),
            sendInternalServerErrorResponse = rq.dispatchResponseStatusCode(doLog, 500, response);

        if (!entityId && entityId !== 0) {
            response.sendStatus(400);
            return;
        }
        fallback([
            sequence([
                eventSourcing.rqGetStateChangesByEntityId(entityId),
                //then(function (stateChanges) {
                //    response.status(200).send(stateChanges);
                //})
                sendOkResponse
            ]),
            //then(function (args) {
            //    response.sendStatus(500);
            //})
            sendInternalServerErrorResponse
        ])(go);
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
     * Resource properties incoming : -
     * Status codes                 :
     *                                202 Accepted
     *                                403 Forbidden : No application store is in use
     *                                405 Method Not Allowed
     * Resource properties outgoing : -
     * Push messages                :
     *                                'mapreducing-events'    (the total number, start timestamp)
     *                                'event-mapreduced'      (the total number, start timestamp, current progress)
     *                                'all-events-mapreduced' ()
     *
     *                                'replaying-events'      (the total number, start timestamp)
     *                                'event-replayed'        (the total number, start timestamp, current progress)
     *                                'all-events-replayed'   ()
     */
    _allStateChangesReplay = exports.replay = function (request, response) {
        'use strict';
        if (request.method !== 'POST') {
            response.sendStatus(405);
            return;
        }
        response.sendStatus(501);
        /*
         app.post("/events/replay", function (request, response) {
         "use strict";
         if (!cqrsService.useCQRS) {
         var msg = "URI '/events/replay' posted when no application store in use!";
         console.warn(msg);
         return response.send(403, msg);
         }
         response.send(202);
         return eventSourcing.replayAllStateChanges(library.Book, io, db);
         });
         */
    };
