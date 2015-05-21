/* global console:false, JSON:false */
/* jshint -W024 */

///////////////////////////////////////////////////////////////////////////////
// Library application store (read-only queries only) (based on MongoDB)
///////////////////////////////////////////////////////////////////////////////

var __ = require("underscore"),

    RQ = require("async-rq"),
    sequence = RQ.sequence,

    rq = require("rq-essentials"),
    then = rq.then,
    go = rq.go,

    utils = require('./utils'),

    mongodb = require("./mongodb.config"),
    serverPush = require("./socketio.config").serverPush,
    messenger = require("./messaging"),

    mongooseEventSourcingMapreduce = require("./mongoose.event-sourcing.mapreduce"),
    mongodbMapReduceStatisticsEmitter = require("./mongodb.mapreduce-emitter"),

    cqrsService = require("./cqrs-service-api"),
    library = require("./library-model"),


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


    /**
     * ...
     *
     * @param entityType
     * @param cursorIndex
     * @param io
     * @param startTime
     * @param numberOfServerPushEmits
     * @param index
     * @param cursorLength
     * @returns {Function}
     * @private
     */
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
     * @param eventMessageName
     * @private
     */
    _replayAllStateChanges =
        function (entityType, io, db, eventMessageName) {
            'use strict';
            //return function requestor(callback, args) {
            console.log('Replaying entire event store / state change log ...');
            var startTime = Date.now(),
                numberOfServerPushEmits = 1000,
                intervalInMillis = 50,
                mongoDBMapReduceStatisticsSocketIoEmitter = new mongodbMapReduceStatisticsEmitter.MongoDBMapReduceStatisticsSocketIoEmitter(io, db, startTime, eventMessageName);

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
                }//,

                //function (callback2, args2) {
                //    callback2(args2, undefined);
                //    return callback(args, undefined);
                //}
            ])(go);
            //};
        };


///////////////////////////////////////////////////////////////////////////////
// Register application subscriptions
///////////////////////////////////////////////////////////////////////////////

// Replay all Book state change events when new state changes have been created
// TODO: Consider doing keeping application stores in sync in a somewhat more incremental manner ...
messenger.subscribe(['cqrs', 'all-statechangeevents-created', 'replay-all-events'], function (message) {
    'use strict';
    sequence([
        rq.do(function () {
            console.log('\'cqrs\' | \'all-statechangeevents-created\' | \'replay-all-events\' :: subscription message received');
        }),
        rq.continueIf(cqrsService.isCqrsEnabled),
        rq.then(function () {
            _replayAllStateChanges(library.Book, serverPush, mongodb.db, 'event-mapreduced');
        }),
        rq.then(function () {
            console.log('MongoDB application store: All entities replayed from Event Store');
        })
    ])(go);
});


messenger.subscribe(['book-updated'], function (updatedBook) {
    'use strict';
    sequence([
        rq.do(function () {
            console.log('\'book-updated\' :: subscription message received');
        }),
        rq.continueIf(cqrsService.isCqrsEnabled),
        rq.value(updatedBook),
        library.Book.update,
        rq.then(function () {
            console.log('MongoDB application store: Book updated');
        })
    ])(go);
});


messenger.subscribe(['book-removed'], function (entityId) {
    'use strict';
    sequence([
        rq.do(function () {
            console.log('\'book-removed\' :: subscription message received');
        }),
        rq.continueIf(cqrsService.isCqrsEnabled),
        rq.value(entityId),
        library.Book.remove,
        rq.then(function () {
            console.log('MongoDB application store: Book removed');
        })
    ])(go);
});


messenger.subscribe(['remove-all-books'], function (message) {
    'use strict';
    console.log('\'remove-all-books\' :: subscription message received');
    return mongodb.mongoose.connection.collections[library.Book.collectionName()].drop(function (err) {
        if (err) {
            console.error('Error when dropping \'' + library.Book.collectionName() + '\' :: ' + err);
        }
        console.warn('\'' + library.Book.collectionName() + '\' collection dropped!');
        messenger.publishAll('all-books-removed');
    });
});
