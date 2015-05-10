/* global JSON:false */
/* jshint -W106 */
var __ = require("underscore"),
    promise = require("promised-io/promise"),
//mongoose = require("mongoose"),

    RQ = require("async-rq"),
    rq = require("rq-essentials"),
    sequence = RQ.sequence,
    fallback = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,
    then = rq.then,
    cancel = rq.cancel,
    go = rq.execute,
    mongooseQueryInvocation = rq.mongooseQueryInvocation,

    curry = require("./fun").curry,
    utils = require("./utils.js"),

    sequenceNumber = require("./mongoose.sequence-number.js"),
    mongooseEventSourcingMapreduce = require("./mongoose.event-sourcing.mapreduce"),
    mongooseEventSourcingModels = require("./mongoose.event-sourcing.model"),
    mongodbMapReduceStatisticsEmitter = require("./mongodb.mapreduce-emitter"),


    /**
     * @returns {Object} Shallow cloned version of given object with all properties prefixed with "value."
     * @private
     */
    _addMapReducePrefixTo = exports._addMapReducePrefixTo =
        function (obj) {
            'use strict';
            var result = {};
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    result["value." + key] = obj[key];
                }
            }
            return result;
        },


    /**
     * @private
     */
    _buildObject = exports._buildObject =
        function (obj) {
            'use strict';
            if (obj.value) {
                obj.value._id = obj._id;
                return obj.value;
            }
            return null;
        },


// Generic Mongoose helper functions
    createUuid = exports.createUuid =
        function () {
            'use strict';
            return new mongooseEventSourcingModels.Uuid()._id;
        },

    collectionName = exports.collectionName =
        function (type) {
            'use strict';
            return type.modelName + "s".toLowerCase();
        },


//////////////////////////////////////
// Private event sourcing functions
//////////////////////////////////////

    /**
     * Creates a state change event.
     *
     * @param method CREATE, UPDATE, or DELETE
     * @param entityType Mongoose model type
     * @param entityId Entity id
     * @param changes the changes object
     * @param user the user issuing the change
     * @returns {StateChange} object
     * @private
     */
    _createStateChange =
        function (method, entityType, entityId, changes, user) {
            'use strict';
            // Create state change event
            var change = new mongooseEventSourcingModels.StateChange();

            // Create state change event: Meta data
            change.user = user;
            change.timestamp = Date.now();
            change.method = method;
            change.type = entityType.modelName;
            change.entityId = change.method === "CREATE" ? createUuid() : entityId;

            // If an UPDATE, add the changes if given: the domain object changes a.k.a. "the diff"/"the delta"
            if (changes && change.method !== "DELETE") {
                change.changes = changes;
            }
            if (change.method === "CREATE" && change.changes.seq) {
                console.log("State change event created [method=" + change.method + ", type=" + change.type + ", seq=" + change.changes.seq + ", entityId=" + change.entityId + "]");
            } else {
                console.log("State change event created [method=" + change.method + ", type=" + change.type + ", entityId=" + change.entityId + "]");
            }

            return change;
        },


    /**
     * Rebuilds entity based on structure from reduced <em>event store</em> objects.
     * Then save it in its default MongoDB collection (designated the <em>application store</em>).
     *
     * @param EntityType Mongoose model type
     * @param reducedEntityChangeEvents The entity object reduced from the event store
     * @returns {Promise}
     * @private
     * @deprecated Will suddenly disappear ...
     */
    _rebuildEntityAndSaveInApplicationStore =
        function (EntityType, reducedEntityChangeEvents) {
            'use strict';
            var dfd = new promise.Deferred(),
                entity = new EntityType({ _id: reducedEntityChangeEvents._id });

            entity.set(reducedEntityChangeEvents.value);
            entity.save(function (err, entity) {
                if (utils.handleError(err, { deferred: dfd })) {
                    return null;
                }
                console.log("Entity #" + entity.seq + " '" + entity.title + "' saved ...OK (ID=" + entity._id + ")");
                return dfd.resolve();
            });
            return dfd.promise;
        },
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
     * Rebuilds entity based on structure from reduced <em>event store</em> objects.
     * Then save it in its default MongoDB collection (designated the <em>application store</em>).
     * This function accepts optional session data parameters for emitting session status messages.
     *
     * Push messages :
     *     'event-replayed'      (the total number, start timestamp, current progress)
     *     'all-events-replayed' ()
     *
     * @param entityType Mongoose model type
     * @param reducedEntityChangeEvents The entity object reduced from the event store
     * @param [io] Server push session: Socket.IO manager
     * @param [startTime] Server push session: start time
     * @param [numberOfServerPushEmits] Server push session: number of messages to emit
     * @param [index] Server push session: session index
     * @param [count] Server push session: total count
     * @returns {Promise}
     * @private
     * @deprecated will suddenly disappear ...
     */
    _rebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere =
        function () {
            'use strict';
            var dfd = new promise.Deferred(),

                entityType, reducedEntityChangeEvents,
                io, index, startTime, numberOfServerPushEmits, count,

                validArguments = arguments.length >= 2 && arguments[0] && arguments[1],
                eligibleForServerPush = arguments.length >= 7 && arguments[2] && arguments[3] && arguments[4] && arguments[5] && arguments[6],
                doServerPush = function (startTime, numberOfServerPushEmits, index, count) {
                    utils.throttleEvents(numberOfServerPushEmits, index, count, function (progressValue) {
                        io.emit("event-replayed", count, startTime, progressValue);
                    });
                    if (index >= count) {
                        io.emit("all-events-replayed");
                    }
                };

            entityType = arguments[0];
            reducedEntityChangeEvents = arguments[1];

            io = arguments[2];
            startTime = arguments[3];
            numberOfServerPushEmits = arguments[4];
            index = arguments[5];
            count = arguments[6];

            if (!validArguments) {
                return dfd.reject("'createSequenceNumberEntity()' arguments is not valid");

            } else {
                if (__.isEmpty(reducedEntityChangeEvents.value)) {
                    return console.log("Replaying object: #" + index + ": " + entityType.modelName + " " + reducedEntityChangeEvents._id + " has no state changes!? ... probably DELETED");

                } else {
                    entityType.findById(reducedEntityChangeEvents._id, function (err, existingEntity) {
                        if (existingEntity) {
                            console.log("Replaying " + entityType.modelName + "s : #" + index + ": " + entityType.modelName + " no " + existingEntity.seq + " \"" + existingEntity.title + "\" already present! {_id:" + existingEntity._id + "}");
                            if (eligibleForServerPush) {
                                doServerPush(startTime, numberOfServerPushEmits, index, count);
                            }
                            return dfd.resolve(arguments);

                        } else {
                            return _rebuildEntityAndSaveInApplicationStore(entityType, reducedEntityChangeEvents)
                                .then(
                                function () {
                                    if (eligibleForServerPush) {
                                        doServerPush(startTime, numberOfServerPushEmits, index, count);
                                    }
                                    return dfd.resolve(arguments);
                                }
                            );
                        }
                    });
                }
            }
            return dfd.promise;
        },

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


//////////////////////////////////////
// Public event sourcing functions
//////////////////////////////////////

    /**
     * Creates new state change and saves it in the <em>event store</em>.
     *
     * @param method CREATE, UPDATE, or DELETE
     * @param entityType Mongoose model type
     * @param entityId Entity id
     * @param changes the changes object
     * @param user the user issuing the change
     * @returns {Promise} StateChange object
     */
    createStateChange = module.exports.createStateChange =
        function (method, entityType, entityId, changes, user) {
            'use strict';
            var dfd = new promise.Deferred();
            _createStateChange(method, entityType, entityId, changes, user)
                .save(function (err, change) {
                    if (utils.handleError(err, { deferred: dfd })) {
                        return null;
                    }
                    console.log('State change event saved ...OK [entityId=' + change.entityId + ']');
                    return dfd.resolve(change);
                });
            return dfd.promise;
        },


    /**
     * Create entity with sequence number.
     * The sequence number property is hard-coded in entity as <code>seq</code>.
     * NB! State change event in <em>Event store</em> only, no <em>application store</em> involved.
     * This function accepts optional session data parameters for emitting session status messages.
     *
     * Push messages :
     *     'statechangeevent-created' (the total number, start timestamp, current progress in percent)
     *
     * @param entityType Mongoose model type
     * @param entityAttributes Entity attributes
     * @param user User(name) responsible for this state change
     * @param [io] Server push session: Socket.IO manager
     * @param [startTime] Server push session: start time
     * @param [numberOfServerPushEmits] Server push session: number of messages to emit
     * @param [index] Server push session: session index
     * @param [count] Server push session: total count
     * @returns {Promise}
     */
    createSequenceNumberEntity = module.exports.createSequenceNumberEntity =
        function () {
            'use strict';
            var dfd = new promise.Deferred(),

                entityType, entityAttributes, user,
                io, startTime, numberOfServerPushEmits, index, count,

                validArguments = arguments.length >= 3 && arguments[0] && arguments[1] && arguments[2],
                eligibleForServerPush = arguments.length >= 8 && arguments[3] && arguments[4] && arguments[5] && arguments[6] && arguments[7];

            entityType = arguments[0];
            entityAttributes = arguments[1];
            user = arguments[2];

            io = arguments[3];
            startTime = arguments[4];
            numberOfServerPushEmits = arguments[5];
            index = arguments[6];
            count = arguments[7];

            if (!validArguments) {
                return dfd.reject("'createSequenceNumberEntity()' arguments is not valid");

            } else {
                sequenceNumber.incrementSequenceNumber(collectionName(entityType), function (err, nextSequenceNumber) {
                    if (utils.handleError(err, { deferred: dfd })) {
                        return null;
                    }
                    entityAttributes.seq = nextSequenceNumber;
                    return createStateChange("CREATE", entityType, null, entityAttributes, user)
                        .then(
                        function (stateChange) {
                            if (eligibleForServerPush) {
                                utils.throttleEvents(numberOfServerPushEmits, index, count, function (progressInPercent) {
                                    io.emit("statechangeevent-created", count, startTime, progressInPercent);
                                });
                            }
                            return dfd.resolve(arguments);
                        }
                    );
                });
            }
            return dfd.promise;
        },


    /**
     * Retrieves all state change events having given entity id.
     *
     * @param entityId the entity id
     * @returns {Promise}
     */
    getStateChangesByEntityId = module.exports.getStateChangesByEntityId =
        function (entityId) {
            'use strict';
            var dfd = new promise.Deferred();
            mongooseEventSourcingModels.StateChange
                .find({ entityId: entityId })
                .sort({ timestamp: 'asc' })
                .exec(function (err, stateChanges) {
                    if (err) {
                        return dfd.reject(err);
                    }
                    return dfd.resolve(stateChanges);
                });
            return dfd.promise;
        },
    rqGetStateChangesByEntityId = module.exports.rqGetStateChangesByEntityId =
        function (entityId) {
            'use strict';
            return function requestor(callback, args) {
                mongooseEventSourcingModels.StateChange
                    .find({ entityId: entityId })
                    .sort({ timestamp: 'asc' })
                    .exec(function (err, stateChanges) {
                        callback(stateChanges, undefined);
                    });
            };
        },


    /**
     * Rebuilds an entity by retrieving all state change events.
     *
     * @param entityType Mongoose model type
     * @param entityId the entity id
     * @returns The rebuilt entity
     */
    rebuild = module.exports.rebuild =
        function (EntityType, entityId) {
            'use strict';
            var obj = new EntityType({ _id: entityId });
            getStateChangesByEntityId(entityId)
                .then(
                function (stateChanges) {
                    obj.set(mongooseEventSourcingMapreduce._reduce_replayStateChangeEvents(null, stateChanges));
                }
            );
            return obj;
        },


    /**
     * Counts all entities of given type.
     *
     * @param entityType Mongoose model type
     * @param conditions Mongoose Query condition object
     */
    _count = module.exports.count =
        function (entityType, conditions) {
            'use strict';
            return function requestor(callback, args) {
                var mapReducePrefixedConditions = _addMapReducePrefixTo(conditions),
                    thenFilterResult = mongooseQueryInvocation('count', mapReducePrefixedConditions);

                return fallback([
                    sequence([
                        //_find(entityType),
                        mongooseEventSourcingMapreduce.find(entityType),
                        thenFilterResult,
                        then(callback)
                    ]),
                    cancel(callback, 'Audit.js :: Counting \'' + entityType.modelName + 's\' via map-reducing event store failed!')
                ])(go);
            };
        },


    project = module.exports.project =
        function (entityType, projectionConditions, sortConditions, skipValue, limitValue) {
            'use strict';
            return function requestor(callback, args) {
                var mapReducePrefixedConditions = _addMapReducePrefixTo(projectionConditions),
                    sortParams = _addMapReducePrefixTo(sortConditions),

                    totalCountRequestor = function (callback, cursor) {
                        //console.log('totalCountRequestor');
                        return cursor.input
                            .count(function (err, totalMapReducedResultCount) {
                                if (err) {
                                    console.error(err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                cursor.totalCount = totalMapReducedResultCount;
                                return callback(cursor, undefined);
                            });
                    },
                    countRequestor = function (callback, cursor) {
                        //console.log('countRequestor');
                        return cursor.input
                            .count(mapReducePrefixedConditions)
                            .exec(function (err, projectedResultCount) {
                                if (err) {
                                    console.error(err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                cursor.count = projectedResultCount;
                                return callback(cursor, undefined);
                            });
                    },
                    booksRequestor = function (callback, cursor) {
                        //console.log('booksRequestor');
                        return cursor.input
                            .find(mapReducePrefixedConditions)
                            .sort(sortParams)
                            .skip(skipValue)
                            .limit(limitValue)
                            .exec(function (err, paginatedResult) {
                                if (err) {
                                    console.error(err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                cursor.books = paginatedResult.map(_buildObject);
                                return callback(cursor, undefined);
                            });
                    };

                return fallback([
                    sequence([
                        //_find(entityType),
                        mongooseEventSourcingMapreduce.find(entityType),

                        // TODO: Crashes ... for some strange reason
                        //       => Seems like the order of the requestors counts ...
                        //       => Probably the MongoDB/Mongoose cursor function returned should be rewritten into RQ requestors, they seem not to be concurrent.
                        /*
                         parallel([
                         totalCountRequestor,
                         countRequestor,
                         booksRequestor
                         ]),
                         function (callback2, results) {
                         callback(results, undefined);
                         return callback2(results, undefined);
                         }
                         */

                        // Workaround A: Build argument holder and pass it sequentially along ...
                        function (callback2, cursor) {
                            var result = { input: cursor, books: null, count: null, totalCount: null };
                            return callback2(result, undefined);
                        },
                        totalCountRequestor,
                        countRequestor,
                        booksRequestor,

                        // Workaround B: Remove input from argument and return it!
                        function (callback2, cursor) {
                            delete cursor.input;
                            callback2(cursor, undefined);
                            return callback(cursor, undefined);
                        }
                    ]),
                    cancel(callback, "Audit.js :: Projecting '" + entityType.modelName + "s' via map-reducing event store failed!")
                ])(go);
            };
        };//,


/**
 * Rebuilds <em>all entities</em> by replaying all StateChange objects from the <em>event store</em> chronologically,
 * and then save them into the <em>application store</em>.
 *
 * Push messages :
 *     'mapreducing-events'    (the total number, start timestamp)
 *     'event-mapreduced'      (the total number, start timestamp, current progress)
 *     'all-events-mapreduced' ()
 *
 *     'replaying-events'      (the total number, start timestamp)
 *     'event-replayed'        (the total number, start timestamp, current progress)
 *     'all-events-replayed'   ()
 *
 * @param entityType
 * @param io
 * @param db
 */
/*
 replayAllStateChanges = module.exports.replayAllStateChanges =
 function (entityType, _clientSidePublisher, db) {
 'use strict';
 return function requestor(callback, args) {
 console.log('Replaying entire event store / state change log ...');
 var startTime = Date.now(),
 numberOfServerPushEmits = 1000,
 intervalInMillis = 50,
 mongoDBMapReduceStatisticsSocketIoEmitter = new mongodbMapReduceStatisticsEmitter.MongoDBMapReduceStatisticsSocketIoEmitter(_clientSidePublisher, db, startTime);

 console.log('mapreducing-events ...');
 _clientSidePublisher.emit('mapreducing-events', null, startTime);
 mongoDBMapReduceStatisticsSocketIoEmitter.start(intervalInMillis);

 // TODO: Clean up these requestors ...
 return sequence([
 //_find(entityType),
 mongooseEventSourcingMapreduce.find(entityType),

 function (callback2, query) {
 console.log('2!');
 mongoDBMapReduceStatisticsSocketIoEmitter.stop();
 return callback2(query, undefined);
 },

 function (callback2, query) {
 query.find(function (err, cursor) {
 console.log('all-events-mapreduced ...');
 _clientSidePublisher.emit('all-events-mapreduced', cursor.length, startTime);
 //if (cursor.length >= 1) {
 console.log('replaying-events ...');
 _clientSidePublisher.emit('replaying-events', cursor.length, startTime);
 //}
 return callback2(cursor, undefined);
 });
 },

 function (callback2, cursor) {
 var conditionalRecreateRequestorArray = [],
 curriedFunc,
 index = 0;

 if (cursor.length < 1) {
 console.log('all-events-replayed!');
 _clientSidePublisher.emit('all-events-replayed');
 callback2(cursor, undefined);
 return callback(args, undefined);
 }
 for (; index < cursor.length; index += 1) {
 curriedFunc = _rqRebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere(
 entityType,
 cursor[index],
 _clientSidePublisher,
 startTime,
 numberOfServerPushEmits,
 index,
 cursor.length);

 conditionalRecreateRequestorArray.push(curriedFunc);
 }
 conditionalRecreateRequestorArray.push(function (callback2, args2) {
 callback2(cursor, undefined);
 return callback(args, undefined);
 });
 sequence(conditionalRecreateRequestorArray)(go);
 },

 function (callback2, results) {
 console.log('all-events-replayed!');
 _clientSidePublisher.emit('all-events-replayed');
 return callback2(results, undefined);
 },

 function (callback2, args2) {
 callback2(args2, undefined);
 return callback(args, undefined);
 }
 ])(go);
 };
 };
 */
