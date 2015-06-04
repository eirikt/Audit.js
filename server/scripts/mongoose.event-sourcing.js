/* global JSON:false */
/* jshint -W106 */
var __ = require("underscore"),
    promise = require("promised-io/promise"),
//mongoose = require("mongoose"),

    RQ = require("async-rq"),
    rq = require("rq-essentials"),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,
    then = rq.then,
    cancel = rq.cancel,
    mongooseQueryInvocation = rq.mongooseQueryInvocation,

    utils = require("./utils.js"),

    sequenceNumber = require("./mongoose.sequence-number.js"),
    mongooseEventSourcingMapreduce = require("./mongoose.event-sourcing.mapreduce"),
    mongooseEventSourcingModels = require("./mongoose.event-sourcing.model"),


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

            if (changes) {
                // Remove MongoDB/Mongoose id property "_id" if exists
                // Frameworks like Backbone need the id property present to do a PUT, and not a CREATE ...
                if (changes._id) {
                    delete changes._id;
                }
                // If a CREATE or an UPDATE, add the changes if given: the domain object changes a.k.a. "the diff"/"the delta"
                if (__.contains(['CREATE', 'UPDATE'], change.method)) {
                    change.changes = changes;
                }
            }

            if (change.method === "CREATE" && change.changes.seq) {
                console.log("State change event created [method=" + change.method + ", type=" + change.type + ", seq=" + change.changes.seq + ", entityId=" + change.entityId + "]");
            } else {
                //console.log("State change event created [method=" + change.method + ", type=" + change.type + ", entityId=" + change.entityId + "]");
                console.log('State change event created [' + JSON.stringify(change) + ']');
            }

            return change;
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
     * @param stateChanges the changes object
     * @param user the user issuing the change
     * @returns {Promise} StateChange object
     */
    _createAndSaveStateChangeRequestorFactory = exports.createAndSaveStateChange =
        function (method, entityType, entityId, stateChanges, user) {
            'use strict';
            return function requestor(callback, args) {
                _createStateChange(method, entityType, entityId, stateChanges, user)
                    .save(function (err, savedStateChange) {
                        //console.log('State change event saved ...OK [entityId=' + savedStateChanges.entityId + ']');
                        console.log('State change event saved ...OK [' + JSON.stringify(savedStateChange) + ']');
                        return callback(savedStateChange, undefined);
                    });
            };
        },

// TODO: To be removed ...
    createStateChange =
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

// TODO: Rewrite, completely!
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
    createSequenceNumberEntity = exports.createSequenceNumberEntity =
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
     * Requestor: Retrieves all state change events having given entity id.
     *
     * @param entityId the entity id
     */
    _getStateChangesByEntityId = exports.getStateChangesByEntityId =
        function (entityId) {
            'use strict';
            return function requestor(callback, args) {
                mongooseEventSourcingModels.StateChange
                    .find({ entityId: entityId })
                    .sort({ timestamp: 'asc' })
                    .exec(function (err, stateChanges) {
                        if (err) {
                            return callback(undefined, err);
                        }
                        return callback(stateChanges, undefined);
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
        /*
    rebuild = module.exports.rebuild =
        function (EntityType, entityId) {
            'use strict';
            var obj = new EntityType({ _id: entityId });
            _getStateChangesByEntityId(entityId)
                .then(
                function (stateChanges) {
                    obj.set(mongooseEventSourcingMapreduce._reduce_replayStateChangeEvents(null, stateChanges));
                }
            );
            return obj;
        },
        */


    /**
     * Rebuilds an entity by replaying all given state changes.
     */
    rebuildEntity = exports.rebuildEntity =
        function (EntityType, entityId) {
            'use strict';
            return function requestor(callback, stateChanges) {
                var entity = new EntityType({ _id: entityId });
                entity.set(mongooseEventSourcingMapreduce._reduce_replayStateChangeEvents(entityId, stateChanges));
                return callback(entity, undefined);
            };
        },


    /**
     * Counts all entities of given type.
     *
     * @param entityType Mongoose model type
     * @param conditions Mongoose Query condition object
     */
    _count = exports.count =
        function (entityType, conditions) {
            'use strict';
            return function requestor(callback, args) {
                var mapReducePrefixedConditions = _addMapReducePrefixTo(conditions),
                    thenFilterResult = mongooseQueryInvocation('count', mapReducePrefixedConditions);

                return firstSuccessfulOf([
                    sequence([
                        mongooseEventSourcingMapreduce.find(entityType),
                        thenFilterResult,
                        then(callback)
                    ]),
                    cancel(callback, 'Audit.js :: Counting \'' + entityType.modelName + 's\' via map-reducing event store failed!')
                ])(rq.run);
            };
        },


    project = exports.project =
        function (entityType, projectionConditions, sortConditions, skipValue, limitValue) {
            'use strict';
            return function requestor(callback, args) {
                var mapReducePrefixedConditions = _addMapReducePrefixTo(projectionConditions),
                    sortParams = _addMapReducePrefixTo(sortConditions),

                    totalCountRequestor = function requestor(callback, args) {
                        //console.log('totalCountRequestor');
                        return args.cursor
                            .count(function (err, totalMapReducedResultCount) {
                                if (err) {
                                    console.error(err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                args.totalCount = totalMapReducedResultCount;
                                return callback(args, undefined);
                            });
                    },
                    countRequestor = function requestor(callback, args) {
                        //console.log('countRequestor');
                        return args.cursor
                            .count(mapReducePrefixedConditions)
                            .exec(function (err, projectedResultCount) {
                                if (err) {
                                    console.error(err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                args.count = projectedResultCount;
                                return callback(args, undefined);
                            });
                    },
                    entitiesRequestor = function requestor(callback, args) {
                        //console.log('booksRequestor');
                        return args.cursor
                            .find(mapReducePrefixedConditions)
                            .sort(sortParams)
                            .skip(skipValue)
                            .limit(limitValue)
                            .exec(function (err, paginatedResult) {
                                if (err) {
                                    console.error(err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                args.books = paginatedResult.map(_buildObject);
                                return callback(args, undefined);
                            });
                    };

                return firstSuccessfulOf([
                    sequence([
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

                        // Workaround A: Build holder argument and pass it sequentially along ...
                        function (callback2, cursor) {
                            var result = { cursor: cursor, books: null, count: null, totalCount: null };

                            // Special treatment: empty cursor means empty database ...
                            if (Object.keys(cursor).length === 0) {
                                return callback(result, undefined);
                                // Nope, just stop further processing here
                                //return callback2(undefined, 'No \'' + entityType.modelName + 's\' entities found in database ...');
                                //return callback2(result, undefined);
                            }
                            return callback2(result, undefined);
                        },
                        totalCountRequestor,
                        countRequestor,
                        entitiesRequestor,

                        // Workaround B: Remove cursor from argument and return it!
                        function (callback2, args) {
                            delete args.cursor;
                            callback2(args, undefined);
                            return callback(args, undefined);
                        }
                    ]),
                    cancel(callback, "Audit.js :: Projecting '" + entityType.modelName + "s' via map-reducing event store failed!")
                ])(rq.run);
            };
        };
