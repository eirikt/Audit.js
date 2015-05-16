/* global JSON:false */
/* jshint -W024 */

var __ = require("underscore"),
    RQ = require("async-rq"),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,

    rq = require("rq-essentials"),
    then = rq.then,
    go = rq.execute,

    curry = require("./fun").curry,
    utils = require('./utils'),
    expect = require('chai').expect,

    mongodb = require("./mongodb.config"),
    serverPush = require("./socketio.config").serverPush,
    messenger = require("./messaging"),

    eventSourcing = require("./mongoose.event-sourcing"),
    eventSourcingModel = require("./mongoose.event-sourcing.model"),
    mongooseEventSourcingMapreduce = require("./mongoose.event-sourcing.mapreduce"),
    mongodbMapReduceStatisticsEmitter = require("./mongodb.mapreduce-emitter"),

    cqrsService = require("./cqrs-service-api"),
    library = require("./library-model"),


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
         var stateChangeCount = curry(rq.mongoose, eventSourcingModel.StateChange, 'count');//,
         /*
         sendMethodNotAllowedResponse = rq.dispatchResponseWithScalarBody(doLog, 405, response),
         sendInternalServerErrorResponse = rq.dispatchResponseStatusCode(doLog, 500, response),
         notPostMethod = function () {
         return request.method !== 'POST';
         };
         */
        firstSuccessfulOf([
            sequence([
                rq.if(utils.notHttpMethod('POST', request)),
                rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                utils.send405MethodNotAllowedResponseWithArgAsBody(response)
            ]),
            sequence([
                parallel([
                    stateChangeCount({ method: 'CREATE' }),
                    stateChangeCount({ method: 'UPDATE' }),
                    stateChangeCount({ method: 'DELETE' })
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
            utils.send500InternalServerErrorResponse(response)
        ])(go);
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
    _allStateChangesByEntityId = exports.events = function (request, response) {
        'use strict';
        var entityId = request.params.entityId,
            entityIdMissing = function () {
                return !entityId && entityId !== 0;
            };

        firstSuccessfulOf([
            sequence([
                rq.if(utils.notHttpMethod('GET', request)),
                rq.value('URI \'' + request.originalUrl + '\' supports GET requests only'),
                utils.send405MethodNotAllowedResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.if(entityIdMissing),
                // TODO: Switch to:
                //rq.if(utils.isMissing('entityId')),

                rq.value('Mandatory parameter \'entityId\' is missing'),
                utils.send400BadRequestResponseWithArgAsBody(response)
            ]),
            sequence([
                eventSourcing.getStateChangesByEntityId(entityId),
                utils.send200OkResponseWithArgAsBody(response)
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])(go);
    },


// TODO: Move to Libray app MongoDB application store logic
    /**
     * Rebuilds entity based on structure from reduced <em>event store</em> objects.
     * Then save it in its default MongoDB collection (designated the <em>application store</em>).
     *
     * @param EntityType Mongoose model type
     * @param reducedEntityChangeEvents The entity object reduced from the event store
     * @private
     */
    _rqBuildEntityAndSaveInApplicationStore =
        function (EntityType, reducedEntityChangeEvents) {
            'use strict';
            return function requestor(callback, args) {
                var entity = new EntityType({ _id: reducedEntityChangeEvents._id });

                entity.set(reducedEntityChangeEvents.value);
                entity.save(function (err, entity) {
                    if (err) {
                        callback(undefined, err);
                    }
                    console.log('Entity #' + entity.seq + ' \'' + entity.title + '\' saved ...OK (ID=' + entity._id + ')');
                    callback(entity, undefined);
                });
            };
        },


// TODO: Move to Libray app MongoDB application store logic
    _rqRebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere =
        function (entityType, cursorIndex, io, startTime, numberOfServerPushEmits, index, cursorLength) {
            'use strict';
            return function (callback, args) {
                var reducedEntityChangeEvents,
                    count,

                    validArguments = true,//arguments.length >= 2 && arguments[0] && arguments[1],
                    eligibleForServerPush = true,//arguments.length >= 7 && arguments[2] && arguments[3] && arguments[4] && arguments[5] && arguments[6],
                    throttledServerPushCallback = function (progressValue) {
                        console.log('event-replayed');
                        io.emit('event-replayed', count, startTime, progressValue);
                    },
                    doServerPush = function (startTime, numberOfServerPushEmits, index, count) {
                        utils.throttleEvents(numberOfServerPushEmits, index, count, throttledServerPushCallback);
                        //if (index >= count - 1) {
                        //    console.log('all-events-replayed');
                        //    _clientSidePublisher.emit('all-events-replayed');
                        //}
                    };

                //entityType = arguments[0];
                reducedEntityChangeEvents = cursorIndex;//arguments[1];

                //_clientSidePublisher = arguments[2];
                //startTime = arguments[3];
                //numberOfServerPushEmits = arguments[4];
                //index = arguments[5];
                count = cursorLength;//arguments[6];

                //if (!validArguments) {
                //    console.error(''createSequenceNumberEntity()' arguments is not valid');
                //    callback(undefined, ''createSequenceNumberEntity()' arguments is not valid');

                //} else {
                if (__.isEmpty(reducedEntityChangeEvents.value)) {
                    return console.log('Replaying object: #' + index + ': ' + entityType.modelName + ' ' + reducedEntityChangeEvents._id + ' has no state changes!? ... probably DELETED');

                } else {
                    entityType.findById(reducedEntityChangeEvents._id, function (err, existingEntity) {
                        if (existingEntity) {
                            console.log('Replaying ' + entityType.modelName + 's : #' + index + ': ' + entityType.modelName + ' no ' + existingEntity.seq + ' \'' + existingEntity.title + '\' already present! {_id:' + existingEntity._id + '}');
                            if (eligibleForServerPush) {
                                doServerPush(startTime, numberOfServerPushEmits, index, count);
                            }
                            return callback(arguments, undefined);

                        } else {
                            sequence([
                                _rqBuildEntityAndSaveInApplicationStore(entityType, reducedEntityChangeEvents),
                                then(function () {
                                    if (eligibleForServerPush) {
                                        doServerPush(startTime, numberOfServerPushEmits, index, count);
                                    }
                                }),
                                then(function () {
                                    return callback(arguments, undefined);
                                })
                            ])(go);
                        }
                    });
                }
            };
        },


// TODO: Move to Libray app MongoDB application store logic
    /**
     * Rebuilds <em>all entities</em> by replaying all StateChange objects from the <em>event store</em> chronologically,
     * and then save them into the <em>application store</em>.
     *
     * Event messages emitted : "mapreducing-events"    (the total number, start timestamp)
     *                          "event-mapreduced"      (the total number, start timestamp, current progress)
     *                          "all-events-mapreduced" ()
     *
     *                          "replaying-events"      (the total number, start timestamp)
     *                          "event-replayed"        (the total number, start timestamp, current progress)
     *                          "all-events-replayed"   ()
     *
     * @param entityType
     * @param io
     * @param db
     * @private
     */
    _replayAllStateChanges =
        function (entityType, io, db) {
            'use strict';
            return function requestor(callback, args) {
                console.log('Replaying entire event store / state change log ...');
                var startTime = Date.now(),
                    numberOfServerPushEmits = 1000,
                    intervalInMillis = 50,
                    mongoDBMapReduceStatisticsSocketIoEmitter = new mongodbMapReduceStatisticsEmitter.MongoDBMapReduceStatisticsSocketIoEmitter(io, db, startTime);

                //console.log('mapreducing-events ...');
                //_clientSidePublisher.emit('mapreducing-events', null, startTime);
                messenger.publishAll('mapreducing-events', null, startTime);
                mongoDBMapReduceStatisticsSocketIoEmitter.start(intervalInMillis);

                // TODO: Clean up these requestors ...
                return sequence([
                    //_find(entityType),
                    mongooseEventSourcingMapreduce.find(entityType),

                    function (callback2, query) {
                        //console.log('2!');
                        mongoDBMapReduceStatisticsSocketIoEmitter.stop();
                        return callback2(query, undefined);
                    },

                    function (callback2, query) {
                        if (__.isEmpty(query)) {
                            console.warn('Nothing returned from database, continuing with zero items ...');
                            messenger.publishAll('all-events-mapreduced', 0, startTime);
                            messenger.publishAll('replaying-events', 0, startTime);
                            return callback2({
                                cursor: {
                                    length: 0
                                }
                            }, undefined);
                        }
                        query.find(function (err, cursor) {
                            //console.log('all-events-mapreduced ...');
                            //_clientSidePublisher.emit('all-events-mapreduced', cursor.length, startTime);
                            messenger.publishAll('all-events-mapreduced', cursor.length, startTime);
                            messenger.publishAll('replaying-events', cursor.length, startTime);

                            //if (cursor.length < 1) {
                            //console.log('replaying-events ...');
                            //_clientSidePublisher.emit('replaying-events', cursor.length, startTime);
                            //} else {
                            //console.log('all-events-replayed!');
                            //_clientSidePublisher.emit('all-events-replayed');
                            //callback2(cursor, undefined);
                            //return callback(args, undefined);
                            //    utils.publish('all-events-replayed');
                            //    callback(args, undefined);
                            //}
                            return callback2(cursor, undefined);
                        });
                    },

                    function (callback2, cursor) {
                        var conditionalRecreateRequestorArray = [],
                            curriedFunc,
                            index = 0;

                        //if (cursor.length < 1) {
                        //    console.log('all-events-replayed!');
                        //    _clientSidePublisher.emit('all-events-replayed');
                        //    callback2(cursor, undefined);
                        //    return callback(args, undefined);
                        //}
                        for (; index < cursor.length; index += 1) {
                            curriedFunc = _rqRebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere(
                                entityType,
                                cursor[index],
                                io,
                                startTime,
                                numberOfServerPushEmits,
                                index,
                                cursor.length);

                            conditionalRecreateRequestorArray.push(curriedFunc);
                        }
                        conditionalRecreateRequestorArray.push(function (callback3, args3) {
                            callback2(cursor, undefined);
                            return callback3(args3, undefined);
                        });
                        sequence(conditionalRecreateRequestorArray)(go);
                    },

                    function (callback2, results) {
                        //console.log('all-events-replayed!');
                        //_clientSidePublisher.emit('all-events-replayed');
                        messenger.publishAll('all-events-replayed');
                        return callback2(results, undefined);
                    },

                    function (callback2, args2) {
                        callback2(args2, undefined);
                        return callback(args, undefined);
                    }
                ])(go);
            };
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
     *                                "event-mapreduced"        (the total number, start timestamp, current progress)
     *                                "all-events-mapreduced"   ()
     *
     *                                "replaying-events"        (the total number, start timestamp)
     *                                "event-replayed"          (the total number, start timestamp, current progress)
     *                                "all-events-replayed"     ()
     */
    _replay = exports.replay = function (request, response) {
        'use strict';
        /*
        var sendAcceptedResponse = rq.dispatchResponseStatusCode(doLog, 202, response),
            sendForbiddenResponse = rq.dispatchResponseWithScalarBody(doLog, 403, response),
            sendMethodNotAllowedResponse = rq.dispatchResponseWithScalarBody(doLog, 405, response),
            sendInternalServerErrorResponse = rq.dispatchResponseStatusCode(doLog, 500, response);
            */

        firstSuccessfulOf([
            sequence([
                rq.if(utils.notHttpMethod('POST', request)),
                rq.return('URI \'' + request.originalUrl + '\' supports POST requests only'),
                utils.send405MethodNotAllowedResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.if(cqrsService.isNotActivated),
                rq.return('URI \'' + request.originalUrl + '\' posted when no application store in use (CQRS not activated)'),
                utils.send403ForbiddenResponseWithArgAsBody(response)
            ]),
            sequence([
               utils.send202AcceptedResponse(response),

                // TODO: Get rid of library domain coupling => request.param('entityType', with some kind of mapping)
                _replayAllStateChanges(library.Book, serverPush, mongodb.db)
                // ... Or just use messaging
                //,rq.then(messenger.publishAll('replay-all-events'))
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])
        (go);
    };


// TODO: Move to Libray app MongoDB application store logic
///////////////////////////////////////////////////////////////////////////////
// Register application subscriptions
///////////////////////////////////////////////////////////////////////////////

// Replay all Book state change events when new state changes have been created
//utils.subscribe(['cqrs', 'all-statechangeevents-created'], function () {
messenger.subscribe(['cqrs', 'all-statechangeevents-created'], function () {
//messenger.subscribe(['cqrs', 'all-statechangeevents-created', 'replay-all-events'], function () {
    'use strict';
    console.log('all-statechangeevents-created :: subscription message received');
    if (cqrsService.isCqrsActivated()) {
        sequence([
            _replayAllStateChanges(library.Book, serverPush, mongodb.db)
        ])(go);
    }
});
