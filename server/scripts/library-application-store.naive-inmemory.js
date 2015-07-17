/* global console:false, JSON:false */
/* jshint -W024 */

///////////////////////////////////////////////////////////////////////////////
// Library application store (read-only queries only) (In-memory)
///////////////////////////////////////////////////////////////////////////////

var __ = require("underscore"),
    httpResponse = require('statuses'),
    httpResponseCode = httpResponse,

    RQ = require("async-rq"),
    sequence = RQ.sequence,

    rq = require("RQ-essentials"),

    utils = require('./utils'),

//mongodb = require("./mongodb.config"),
//clientSidePublisher = require("./socketio.config").serverPush,
    messenger = require("./messaging"),

    mongooseEventSourcingMapreduce = require("./mongoose.event-sourcing.mapreduce"),

    cqrs = require("./cqrs-service-api"),
    library = require("./library-model.mongoose"),


    _name = exports.name = 'Library naïve in-memory application store',
    _id = exports.id = 'naive-inmemory',
    _primaryApplicationStore = exports.isPrimaryApplicationStore = false,
    _completeApplicationStore = exports.isCompleteApplicationStore = false,
    _state = {},


    _db = {},


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
                _db[entity._id] = entity;
                console.log('Naïve in-memory application store :: Entity #' + entity.sequenceNumber + ' \'' + entity.title + '\' saved ...OK (ID=' + entity._id + ')');
                callback(entity, undefined);
            };
        },


    _rebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere =
        function (entityType, cursorIndex, io, startTime, numberOfServerPushEmits, index, cursorLength) {
            'use strict';
            return function (callback, args) {
                var reducedEntityChangeEvents = cursorIndex,
                    count = cursorLength,
                    eligibleForServerPush = true,
                    throttledServerPushCallback = function (progressValue) {
                        console.log('Naïve in-memory application store :: event-replayed (not published ...)');
                        // TODO: Silence this application store by config => only when isPrimaryApplicationStore === true
                        //io.emit('event-replayed', count, startTime, progressValue);
                    },
                    doServerPush = function (startTime, numberOfServerPushEmits, index, count) {
                        utils.throttleEvents(numberOfServerPushEmits, count, index, throttledServerPushCallback);
                    };

                if (__.isEmpty(reducedEntityChangeEvents.value)) {
                    return console.log('Naïve in-memory application store :: Replaying object: #' + index + ': ' + entityType.modelName + ' ' + reducedEntityChangeEvents._id + ' has no state changes!? ... probably DELETED');

                } else {
                    var existingEntity = _db[reducedEntityChangeEvents._id];

                    if (existingEntity) {
                        console.log('Naïve in-memory application store :: Replaying ' + entityType.modelName + 's : #' + index + ': ' + entityType.modelName + ' no ' + existingEntity.sequenceNumber + ' \'' + existingEntity.title + '\' already present! {_id:' + existingEntity._id + '}');
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
            //var numberOfServerPushEmits = 1000,
            //    intervalInMillis = 50;//,

            return function (callback, query2) {
                //var startTime = Date.now();//,
                //numberOfServerPushEmits = 1000,
                //intervalInMillis = 50;//,
                //mongoDbMapReduceStatisticsSocketIoEmitter = new mongodbMapReduceStatisticsEmitter.MongoDbMapReduceStatisticsSocketIoEmitter(clientSidePublisher, mongodb.db, startTime, eventMessageName);
                // Replay all Book state change events when new state changes have been created
                // TODO: Consider doing keeping application stores in sync in a somewhat more incremental manner ...

                console.log('Naïve in-memory application store :: Replaying entire event store / state change log ...');

                sequence([
                    //rq.do(function () {
                    //    console.log('Naïve in-memory application store :: \'cqrs\' | \'all-statechangeevents-created\' | \'replay-all-events\' :: subscription message received');
                    //}),
                    rq.continueIf(cqrs.isEnabled),
                    // TODO: Revisit when adding consistency status indicators in UI
                    //rq.then(function () {
                    //    _setState('consistent', false);
                    //}),
                    rq.then(function () {
                        console.log('Naïve in-memory application store :: Replaying entire event store / state change log ...');
                        var startTime = Date.now(),
                            numberOfServerPushEmits = 1000,
                            intervalInMillis = 50;

                        // TODO: Silence this application store by config
                        //messenger.publishAll('mapreducing-events', null, startTime);

                        // TODO: Ugh, clean up these requestors ...
                        return sequence([
                            mongooseEventSourcingMapreduce.find(library.Book),

                            function (callback2, query) {
                                if (__.isEmpty(query)) {
                                    console.warn('Naïve in-memory application store :: Nothing returned from database, continuing with zero items ...');
                                    // TODO: Silence this application store by config
                                    //messenger.publishAll('all-events-mapreduced', 0, startTime);
                                    //messenger.publishAll('replaying-events', 0, startTime);
                                    return callback2({
                                        cursor: {
                                            length: 0
                                        }
                                    }, undefined);
                                }
                                query.find(function (err, cursor) {
                                    // TODO: Silence this application store by config
                                    //messenger.publishAll('all-events-mapreduced', cursor.length, startTime);
                                    //messenger.publishAll('replaying-events', cursor.length, startTime);
                                    return callback2(cursor, undefined);
                                });
                            },

                            function (callback2, cursor) {
                                var conditionalRecreateRequestorArray = [],
                                    curriedFunc,
                                    index = 0;

                                if (!cursor) {
                                    console.warn('Naïve in-memory application store :: UNEXPECTED! Missing cursor from query ... WILL NOT REBUILD this app store');
                                    return callback2(cursor, undefined);
                                }

                                for (; index < cursor.length; index += 1) {
                                    curriedFunc = _rebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere(
                                        library.Book,
                                        cursor[index],

                                        //clientSidePublisher,
                                        null,

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
                                // TODO: Silence this application store by config
                                //messenger.publishAll('all-events-replayed');
                                return callback2(results, undefined);
                            }
                        ])(rq.run);
                    }),
                    // TODO: Revisit when adding consistency status indicators in UI
                    //rq.then(function () {
                    //    _setState('consistent', true);
                    //}),
                    rq.then(function () {
                        console.log('Naïve in-memory application store :: All entities replayed from Event Store');
                    }),
                    rq.then(function () {
                        callback(query2, undefined);
                    })
                ])(rq.run);
            };
        },


///////////////////////////////////////////////////////////////////////////////
// Public functions
///////////////////////////////////////////////////////////////////////////////

    _count = exports.count =
        function () {
            'use strict';
            return function requestor(callback, args) {
                var numberOfItems = Object.keys(_db).length;
                console.log('Naïve in-memory application store :: count returning ' + numberOfItems);
                return callback({ count: numberOfItems }, undefined);
            };
        },

    _find = exports.find =
        function (query) {
            'use strict';
            return function requestor(callback, args) {
                // TODO: Implement ...
                //var books = {},
                //    count = 0,
                //    totalCount = 0;

                ////console.log('Naïve in-memory application store :: Fake returning no book objects and weird count ...');
                ////return callback({
                ////    books: {},
                ////    count: 8765,
                ////    totalCount: 8765
                ////}, undefined);

                //Object.keys(_db).forEach(function (item) {
                //    console.log('Naïve in-memory application store :: item ' + JSON.stringify(item));
                //});
                //return callback({ books: books, count: count, totalCount: totalCount }, undefined);
                return callback(undefined, httpResponseCode['Not Implemented']);
            };
        },


    _updateBook = exports.updateBook =
        function requestor(callback, updatedBook) {
            'use strict';
            sequence([
                rq.do(function () {
                    console.log('Naïve in-memory application store :: Updating book (entityId=' + updatedBook.entityId + ') ...');
                }),
                // TODO: Revisit when adding consistency status indicators in UI
                //rq.then(function () {
                //    _setState('consistent', false);
                //}),
                rq.value(updatedBook),
                function (callback, updatedBook) {
                    _db[updatedBook._id] = updatedBook;
                    callback(updatedBook, undefined);
                },
                // TODO: Revisit when adding consistency status indicators in UI
                //rq.then(function () {
                //    _setState('consistent', true);
                //}),
                rq.then(function () {
                    console.log('Naïve in-memory application store :: Book (entityId=' + updatedBook.entityId + ') updated');
                })
            ])(rq.run);
        },


    _removeBook = exports.removeBook =
        function requestor(callback, entityId) {
            'use strict';
            sequence([
                rq.do(function () {
                    console.log('Naïve in-memory application store :: Removing book (entityId=' + entityId + ') ...');
                }),
                // TODO: Revisit when adding consistency status indicators in UI
                //rq.then(function () {
                //    _setState('consistent', false);
                //}),
                rq.value(entityId),
                function (callback, entityId) {
                    // JavaScript Array, remove element - nope, using associative array/object instead
                    //var index = _db.indexOf(entityId);
                    //if (index > -1) {
                    //    _db.splice(index, 1);
                    //}
                    delete _db[entityId];
                    callback(entityId, undefined);
                },
                // TODO: Revisit when adding consistency status indicators in UI
                //rq.then(function () {
                //    _setState('consistent', true);
                //}),
                rq.then(function () {
                    console.log('Naïve in-memory application store :: Book (entityId=' + entityId + ') removed');
                })
            ])(rq.run);
        },


    _reset = exports.reset =
        function requestor(callback, args) {
            'use strict';
            console.log('Naïve in-memory application store :: Resetting ...');
            // TODO: Revisit when adding consistency status indicators in UI
            //_setState('consistent', false);
            _db = {};
            // TODO: Revisit when adding consistency status indicators in UI
            //_setState('consistent', true);
            console.warn('Naïve in-memory application store :: \'' + library.Book.collectionName() + '\' collection purged!');
            messenger.publishAll('all-books-removed', _id);
            return callback(205, undefined);
        };
