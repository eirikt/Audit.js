// Module dependencies, external
var _ = require("underscore")
    , promise = require("promised-io/promise")
    , mongoose = require("mongoose")


// Module dependencies, local
    , sequenceNumber = require("./mongoose.sequence-number.js")
    , error = require("./error.js")
    , utils = require("./utils.js")


// Mongoose schemas
    , StateChangeMongooseSchema = exports.StateChangeMongooseSchema = new mongoose.Schema({
        //user: String
        user: { type: String, index: true },

        timestamp: Date,
        //timestamp: { type: Date, default: Date.now }, // Possible, yes, but less maintainable code

        //method: String,
        method: { type: String, index: true },

        //type: String
        type: { type: String, index: true },

        //entityId: String,
        entityId: { type: String, index: true },

        changes: Object
    })


// Mongoose models (design rule: lower-case collection names)
    , Uuid = exports.Uuid = mongoose.model("uuid", mongoose.Schema({}))
    , StateChange = exports.StateChange = mongoose.model("statechange", StateChangeMongooseSchema)


// Generic Mongoose helper functions
    , createUuid = exports.createUuid = function () {
        return new Uuid()._id;
    }

    , collectionName = exports.collectionName = function (type) {
        return type.modelName + "s".toLowerCase();
    }





//////////////////////////////////////
// MapReduce functions
//////////////////////////////////////

/**
 * Mongoose MapReduce :: Map: Group all state change events by entityId
 * @private
 */
    , _map_groupByEntityId = function () {
        emit(this.entityId, this);
    }


/**
 * Mongoose MapReduce :: Reduce: Replay state change events by merging them in the right order
 * 1) Sort all object state change events by timestamp ascending (oldest first and then the newer ones)
 * 2) Check that object first state change event method is a CREATE
 * 3) Abort further processing if the last object state change event method is DELETE (return null)
 * 4) Replay all object state change events (by reducing all the diffs) (abort further processing if one of the state change events being replayed have a method other than UPDATE)
 * 5) Return the "replayed" (collapsed) object
 * @private
 */
    , _reduce_replayStateChangeEvents = function (key, values) {
        var sortedStateChanges = values.sort(function (a, b) {
            return a.timestamp > b.timestamp
        });
        if (sortedStateChanges[0].method !== "CREATE") {
            throw new Error("First event for book with id=" + key + " is not a CREATE event, rather a " + sortedStateChanges[0].method + "\n");
        }
        if (sortedStateChanges[sortedStateChanges.length - 1].method === "DELETE") {
            return null;
        }
        var retVal = {};
        sortedStateChanges.forEach(function (stateChange, index) {
            if (index > 0 && stateChange.method !== "UPDATE") {
                throw new Error("Expected UPDATE event, was " + stateChange.method + "\n");
            }
            for (var key in stateChange.changes) {
                retVal[key] = stateChange.changes[key];
            }
        });
        return retVal;
    }


/**
 * Mongoose MapReduce :: Finalize/Post-processing:
 * If Reduce phase is bypassed due to a single object state change event,
 * then return this single object state change event as the object state.
 * @private
 */
    , _mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects = function (key, reducedValue) {
        // TODO: move this to StateChange definition
        isStateChange = function (obj) {
            // TODO: how to include external references inside mapreduce functions ...
            // -> http://stackoverflow.com/questions/7273379/how-to-use-variables-in-mongodb-map-reduce-map-function
            return obj && obj.changes /*&& _.isObject(obj.changes)*/;
        };
        if (reducedValue) {
            return isStateChange(reducedValue) ? reducedValue.changes : reducedValue;
        }
        return null;
    }


/**
 * Of given type, map by entity id, and reduce all state change events by replaying them.
 *
 * @param entityType Mongoose model type
 * @returns Mongoose MapReduce configuration object
 * @private
 */
    , _getMapReduceConfigOfType = function (entityType) {
        return {
            query: { type: entityType.modelName },
            map: _map_groupByEntityId,
            reduce: _reduce_replayStateChangeEvents,
            finalize: _mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects,
            out: { replace: "filteredEntities", inline: 1 }
        };
    }


/**
 * @private
 */
    , _buildObject = function (obj) {
        if (obj.value) {
            obj.value._id = obj._id;
            return obj.value;
        }
        return null;
    }


/**
 * @private
 */
    , _isNotNull2 = function (obj) {
        return obj != null && obj.value != null;
    }


/**
 * @private
 */
    , _isNotNull = function (obj) {
        return obj != null;
    }


/**
 * @returns {Object} Shallow cloned version of given object with all properties prefixed with "value."
 * @private
 */
    , _addMapReducePrefixTo = function (obj) {
        var result = {};
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                result["value." + key] = obj[key];
            }
        }
        return result;
    }





//////////////////////////////////////
// Private event sourcing functions
//////////////////////////////////////

/**
 * Retrieves all entities of given type by map-reducing all state change state entities.
 *
 * @param entityType Mongoose model type
 * @returns {Promise} of Mongoose Query function
 * @private
 */
    , _find = function (entityType) {
        var dfd = new promise.Deferred();
        StateChange.mapReduce(_getMapReduceConfigOfType(entityType), function (err, results) {
            if (error.handle(err, { deferred: dfd })) {
                return null;
            }
            // TODO: how to filter out null objects in mapreduce step?
            // Removing deleted entities => value set to null in reduce step above
            return dfd.resolve(results.find({ value: { "$ne": null }}));
        });
        return dfd.promise;
    }


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
    , _createStateChange = function (method, entityType, entityId, changes, user) {
        // Create state change event
        var change = new StateChange();

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
        console.log("State change event created [method=" + change.method + ", type=" + change.type + ", entityId=" + change.entityId + "]");
        return change;
    }


/**
 * Rebuilds entity based on structure from reduced <em>event store</em> objects.
 * Then save it in its default MongoDB collection (designated the <em>application store</em>).
 *
 * @param entityType Mongoose model type
 * @param reducedEntityChangeEvents The entity object reduced from the event store
 * @returns {Promise}
 * @private
 */
    , _rebuildEntityAndSaveInApplicationStore = function (entityType, reducedEntityChangeEvents) {
        var dfd = new promise.Deferred(),
            entity = new entityType({ _id: reducedEntityChangeEvents._id });

        entity.set(reducedEntityChangeEvents.value);
        entity.save(function (err, entity) {
            if (error.handle(err, { deferred: dfd })) {
                return null;
            }
            console.log("Entity #" + entity.seq + " '" + entity.title + "' saved ...OK (ID=" + entity._id + ")");
            return dfd.resolve();
        });
        return dfd.promise;
    }


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
 */
    , _rebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere = function () {
        var dfd = new promise.Deferred(),

            entityType, reducedEntityChangeEvents,
            io, index, startTime, numberOfServerPushEmits, count,

            validArguments = arguments.length >= 2 && arguments[0] && arguments[1],
            eligibleForServerPush = arguments.length >= 7 && arguments[2] && arguments[3] && arguments[4] && arguments[5] && arguments[6],
            doServerPush = function (startTime, numberOfServerPushEmits, index, count) {
                utils.throttleEvents(numberOfServerPushEmits, index, count, function (progressValue) {
                    io.sockets.emit("event-replayed", count, startTime, progressValue);
                });
                if (index >= count) {
                    io.sockets.emit("all-events-replayed");
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
            if (_.isEmpty(reducedEntityChangeEvents.value)) {
                return console.log("Replaying object: #" + index + ": " + entityType.modelName + " " + reducedEntityChangeEvents._id + " has no state changes!? ... probably DELETED");

            } else {
                entityType.findById(reducedEntityChangeEvents._id, function (err, entity) {
                    if (entity) {
                        console.log("Replaying " + entityType.modelName + "s : #" + index + ": " + entityType.modelName + " no " + entity.seq + " \"" + entity.title + "\" already present! {_id:" + entity._id + "}");
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
    }





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
    , createStateChange = exports.createStateChange = function (method, entityType, entityId, changes, user) {
        var dfd = new promise.Deferred();
        _createStateChange(method, entityType, entityId, changes, user)
            .save(function (err, change) {
                if (error.handle(err, { deferred: dfd })) {
                    return null;
                }
                console.log("State change event saved ...OK [entityId=" + change.entityId + "]");
                return dfd.resolve(change);
            });
        return dfd.promise;
    }


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
    , createSequenceNumberEntity = exports.createSequenceNumberEntity = function () {
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
                if (error.handle(err, { deferred: dfd })) {
                    return null;
                }
                entityAttributes.seq = nextSequenceNumber;
                return createStateChange("CREATE", entityType, null, entityAttributes, user)
                    .then(
                    function (stateChange) {
                        if (eligibleForServerPush) {
                            utils.throttleEvents(numberOfServerPushEmits, index, count, function (progressInPercent) {
                                io.sockets.emit("statechangeevent-created", count, startTime, progressInPercent);
                            });
                        }
                        return dfd.resolve(arguments);
                    }
                );
            });
        }
        return dfd.promise;
    }


/**
 * Retrieves all state change events having given entity id.
 *
 * @param entityId the entity id
 * @returns {Promise}
 */
    , getStateChangesByEntityId = exports.getStateChangesByEntityId = function (entityId) {
        var dfd = new promise.Deferred();
        StateChange
            .find({ entityId: entityId })
            .sort({ timestamp: "asc" })
            .exec(function (err, stateChanges) {
                if (err) {
                    return dfd.reject(err);
                }
                return dfd.resolve(stateChanges);
            });
        return dfd.promise;
    }


/**
 * Rebuilds an entity by retrieving all state change events.
 *
 * @param entityType Mongoose model type
 * @param entityId the entity id
 * @returns The rebuilt entity
 */
    , rebuild = exports.rebuild = function (entityType, entityId) {
        var obj = new entityType({ _id: entityId });
        getStateChangesByEntityId(entityId)
            .then(
            function (stateChanges) {
                obj.set(_reduce_replayStateChangeEvents(null, stateChanges));
            }
        );
        return obj;
    }


/**
 * Counts all entities of given type.
 *
 * @param entityType Mongoose model type
 * @param conditions Mongoose find condition object
 * @returns {Promise}
 */
    , count = exports.count = function (entityType, conditions) {
        var dfd = new promise.Deferred();
        _find(entityType)
            .then(
            function (results) {
                return results.count(_addMapReducePrefixTo(conditions), function (err, count) {
                    if (error.handle(err, { deferred: dfd })) {
                        return null;
                    }
                    return dfd.resolve(count);
                });
            },
            function (err) {
                error.handle(err, { deferred: dfd });
            });
        return dfd.promise;
    }


/**
 * Makes a projection/search for entities of given type and conditions.
 *
 * @param entityType Mongoose model type
 * @param findConditions Mongoose find condition object
 * @param sortConditions Mongoose find condition object
 * @param skipValue Mongoose find condition value
 * @param limitValue Mongoose find condition value
 * @returns {Promise}
 */
    , project = exports.project = function (entityType, findConditions, sortConditions, skipValue, limitValue) {
        var dfd = new promise.Deferred();
        _find(entityType)
            .then(
            function (results) {
                return results
                    .find(function (err, totalMapReducedResult) {
                        var findConditions = _addMapReducePrefixTo(findConditions);
                        return results
                            .find(findConditions)
                            .exec(function (err, projectedResult) {
                                var sortParams = _addMapReducePrefixTo(sortConditions);
                                return results
                                    .find(findConditions)
                                    .sort(sortParams)
                                    .skip(skipValue)
                                    .limit(limitValue)
                                    .exec(function (err, paginatedResult) {
                                        var books = paginatedResult.map(_buildObject);//.filter(_isNotNull);
                                        return dfd.resolve({ books: books, count: projectedResult.length, totalCount: totalMapReducedResult.length });
                                    }
                                );
                            }
                        );
                    }
                );
            }, function (err) {
                error.handle(err, { deferred: dfd });
            });
        return dfd.promise;
    }


/**
 * Constructor function for Socket.io emitting statistics from MongoDB map-reduce job.
 *
 * Push messages :
 *     'event-mapreduced' (the total number, start timestamp, current progress in percent)
 *
 * @param db
 * @param io
 * @param startTime
 * @private
 */
    ,
    _MongoDBMapReduceStatisticsSocketIoEmitter = function (io, db, startTime) {
        this.inprogCollection = db.collection("$cmd.sys.inprog");
        this.intervalProcessId = 0;
        this.start = function (intervalInMilliseconds) {
            var self = this;
            self.intervalProcessId = setInterval(function () {
                self.inprogCollection.findOne(function (err, data) {
                    try {
                        var
                        //msg = data.inprog[0].msg,
                            progress = data.inprog[0].progress;
                        if (progress.total && progress.total > 1) {
                            io.sockets.emit("event-mapreduced", progress.total, startTime, utils.getPercentage(progress.done, progress.total));
                        }
                    } catch (ex) {
                        // Just taking the easy and lazy way out on this one ...
                    }
                });
            }, intervalInMilliseconds);
        };
        this.stop = function () {
            clearInterval(this.intervalProcessId);
        }
    }


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
 */
    , replayAllStateChanges = exports.replayAllStateChanges = function (type, io, db) {
        console.log("Replaying entire event store / state change log ...");
        var startTime = Date.now(),
            numberOfServerPushEmits = 1000,
            intervalInMillis = 50,
            mongoDBMapReduceStatisticsSocketIoEmitter = new _MongoDBMapReduceStatisticsSocketIoEmitter(io, db, startTime);

        io.sockets.emit("mapreducing-events", null, startTime);
        mongoDBMapReduceStatisticsSocketIoEmitter.start(intervalInMillis);

        return _find(type)
            .then(
            function (results) {
                mongoDBMapReduceStatisticsSocketIoEmitter.stop();

                return results.find(function (err, cursor) {
                    io.sockets.emit("all-events-mapreduced", cursor.length, startTime);

                    if (cursor.length >= 1) {
                        io.sockets.emit("replaying-events", cursor.length, startTime);
                    }
                    var arrayOfConditionalRecreateFunctions = [], index = 0;
                    for (; index < cursor.length; index += 1) {
                        arrayOfConditionalRecreateFunctions.push(
                            _.partial(_rebuildEntityAndSaveInApplicationStoreIfNotAlreadyThere,
                                type,
                                cursor[index],
                                io,
                                startTime,
                                numberOfServerPushEmits,
                                index,
                                cursor.length
                            )
                        );
                    }
                    return promise.all(promise.seq(arrayOfConditionalRecreateFunctions))
                        .then(
                        function () {
                            io.sockets.emit("all-events-replayed")
                        }
                    );
                });

            }, function (err) {
                if (err.message === "ns doesn't exist") {
                    console.warn(err);
                    return io.sockets.emit("all-events-replayed");
                } else {
                    return error.handle(err);
                }
            }
        );
    };
