/* global console:false, JSON:false */
/* jshint -W024 */

///////////////////////////////////////////////////////////////////////////////
// Library application store (read-only queries only) (based on MongoDB)
///////////////////////////////////////////////////////////////////////////////

var __ = require("underscore"),

    RQ = require("async-rq"),
    sequence = RQ.sequence,

    rq = require("RQ-essentials"),

    utils = require('./utils'),

    mongodb = require("./mongodb.config"),
    clientSidePublisher = require("./socketio.config").serverPush,
    messenger = require("./messaging"),

    //mongooseEventSourcingMapreduce = require("./mongoose.event-sourcing.mapreduce"),
    mongodbMapReduceStatisticsEmitter = require("./mongodb.mapreduce-emitter"),

    library = require("./library-model"),

    _name = exports.name = 'Library MongoDB application store',
    _id = exports.id = 'mongodb',
    _primaryApplicationStore = exports.isPrimaryApplicationStore = true,    // At least one, only one
    _completeApplicationStore = exports.isCompleteApplicationStore = true,  // At least one
    _state = {},


    _getState = exports.getState = function (name) {
        'use strict';
        return _state[name];
    },

    _setState = function (name, value) {
        'use strict';
        var messageId = _id + '_' + name;
        _state[name] = value;
        messenger.publishAll(messageId, value);
    },


    /**
     * Rebuilds entity based on structure from reduced <em>event store</em> objects.
     * Then save it in its default MongoDB collection (designated the <em>application store</em>).
     *
     * @param EntityType Mongoose model type
     * @param reducedEntityChangeEvents The entity object reduced from the event store
     * @private
     */
    _buildEntityAndSaveInApplicationStore =
        function (EntityType, reducedEntityChangeEvents) {
            'use strict';
            return function requestor(callback, args) {
                var entity = new EntityType({ _id: reducedEntityChangeEvents._id });

                entity.set(reducedEntityChangeEvents.value);
                entity.save(function (err, entity) {
                    if (err) {
                        callback(undefined, err);
                    }
                    console.log('MongoDB application store :: Entity #' + entity.seq + ' \'' + entity.title + '\' saved ...OK (ID=' + entity._id + ')');
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
    _rebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere =
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
                    return console.log('MongoDB application store :: Replaying object: #' + index + ': ' + entityType.modelName + ' ' + reducedEntityChangeEvents._id + ' has no state changes!? ... probably DELETED');

                } else {
                    entityType.findById(reducedEntityChangeEvents._id, function (err, existingEntity) {
                        if (existingEntity) {
                            console.log('MongoDB application store :: Replaying ' + entityType.modelName + 's : #' + index + ': ' + entityType.modelName + ' no ' + existingEntity.seq + ' \'' + existingEntity.title + '\' already present! {_id:' + existingEntity._id + '}');
                            if (eligibleForServerPush) {
                                doServerPush(startTime, numberOfServerPushEmits, index, count);
                            }
                            return callback(arguments, undefined);

                        } else {
                            sequence([
                                _buildEntityAndSaveInApplicationStore(entityType, reducedEntityChangeEvents),
                                rq.then(function () {
                                    if (eligibleForServerPush) {
                                        doServerPush(startTime, numberOfServerPushEmits, index, count);
                                    }
                                }),
                                rq.then(function () {
                                    return callback(arguments, undefined);
                                })
                            ])(rq.run);
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
    _replayAllStateChanges = exports.replayAllStateChanges =
        function (entityType, /*io, db,*/ eventMessageName) {
            'use strict';
            var //startTime = Date.now(),
                numberOfServerPushEmits = 1000,
                intervalInMillis = 50;//,

            return function (callback, query2) {
                var startTime = Date.now(),
                //numberOfServerPushEmits = 1000,
                //intervalInMillis = 50,
                    mongoDbMapReduceStatisticsSocketIoEmitter = new mongodbMapReduceStatisticsEmitter.MongoDbMapReduceStatisticsSocketIoEmitter(clientSidePublisher, mongodb.db, startTime, eventMessageName);

                console.log('MongoDB application store :: Replaying entire event store / state change log ...');

                messenger.publishAll('mapreducing-events', null, startTime);
                mongoDbMapReduceStatisticsSocketIoEmitter.start(intervalInMillis);
                //mongoDbMapReduceStatisticsSocketIoEmitter.stop();
                //return callback2(query, undefined);
                //},
                // TODO: Clean up these requestors ...
                //return
                var t = query2;

                sequence([
                    //mongooseEventSourcingMapreduce.find(entityType),

                    function (callback2, query) {
                        mongoDbMapReduceStatisticsSocketIoEmitter.stop();
                        return callback2(t, undefined);
                    },

                    function (callback2, query) {
                        if (__.isEmpty(query)) {
                            console.warn('MongoDB application store :: Nothing returned from database, continuing with zero items ...');
                            messenger.publishAll('all-events-mapreduced', 0, startTime);
                            messenger.publishAll('replaying-events', 0, startTime);
                            return callback2({
                                cursor: {
                                    length: 0
                                }
                            }, undefined);
                        }
                        query.find(function (err, cursor) {
                            if (!cursor) {
                                console.warn('MongoDB application store :: UNEXPECTED! Missing cursor from query ...');
                                messenger.publishAll('all-events-mapreduced', 0, startTime);
                                messenger.publishAll('replaying-events', 0, startTime);
                                return callback2(cursor, undefined);
                            }
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

                        if (!cursor) {
                            console.warn('MongoDB application store :: UNEXPECTED! Missing cursor from query ... WILL NOT REBUILD this app store');
                            return callback2(cursor, undefined);
                        }
                        //if (cursor.length < 1) {
                        //    console.log('all-events-replayed!');
                        //    _clientSidePublisher.emit('all-events-replayed');
                        //    callback2(cursor, undefined);
                        //    return callback(args, undefined);
                        //}
                        for (; index < cursor.length; index += 1) {
                            curriedFunc = _rebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere(
                                entityType,
                                cursor[index],
                                clientSidePublisher,
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
                        sequence(conditionalRecreateRequestorArray)(rq.run);
                    },

                    function (callback2, results) {
                        //console.log('all-events-replayed!');
                        //_clientSidePublisher.emit('all-events-replayed');
                        messenger.publishAll('all-events-replayed');
                        return callback2(results, undefined);
                    }

                ])(function () {
                    return query2;
                });

                callback(query2, undefined);
            };
        },


    _updateBook = exports.updateBook =
        function requestor(callback, updatedBook) {
            'use strict';
            sequence([
                rq.do(function () {
                    console.log('MongoDB application store :: Updating book (entityId=' + updatedBook.entityId + ') ...');
                }),
                // TODO: Revisit when adding consistency status indicators in UI
                //rq.then(function () {
                //    _setState('consistent', false);
                //}),
                rq.value(updatedBook),
                library.Book.update,
                // TODO: Revisit when adding consistency status indicators in UI
                //rq.then(function () {
                //    _setState('consistent', true);
                //}),
                rq.then(function () {
                    console.log('MongoDB application store :: Book (entityId=' + updatedBook.entityId + ') updated');
                })
            ])(rq.run);
        },


    _removeBook = exports.removeBook =
        function requestor(callback, entityId) {
            'use strict';
            sequence([
                rq.do(function () {
                    console.log('MongoDB application store :: Removing book (entityId=' + entityId + ') ...');
                }),
                // TODO: Revisit when adding consistency status indicators in UI
                //rq.then(function () {
                //    _setState('consistent', false);
                //}),
                rq.value(entityId),
                library.Book.remove,
                // TODO: Revisit when adding consistency status indicators in UI
                //rq.then(function () {
                //    _setState('consistent', true);
                //}),
                rq.then(function () {
                    console.log('MongoDB application store :: Book (entityId=' + entityId + ') removed');
                })
            ])(rq.run);
        },


    _reset = exports.reset =
        function requestor(callback, args) {
            'use strict';
            console.log('MongoDB application store :: Resetting ...');
            // TODO: Revisit when adding consistency status indicators in UI
            //_setState('consistent', false);
            return mongodb.mongoose.connection.collections[library.Book.collectionName()].drop(function (err) {
                if (err) {
                    console.error('MongoDB application store :: Error when dropping \'' + library.Book.collectionName() + '\' :: ' + err);
                    // TODO: Proper error handling
                }
                // TODO: Revisit when adding consistency status indicators in UI
                //_setState('consistent', true);
                console.warn('MongoDB application store :: \'' + library.Book.collectionName() + '\' collection purged!');
                messenger.publishAll('all-books-removed', _id);
                //return callback(args, undefined);
                // return callback(_id + '_all-books-removed', undefined);
                return callback(205, undefined);
            });
        };
