// Module dependencies, external
var _ = require("underscore"),
    promise = require("promised-io/promise"),
    mongoose = require("mongoose");


// Mongoose schemas
var StateChangeMongooseSchema = exports.StateChangeMongooseSchema = new mongoose.Schema({
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
});


// Mongoose models (design rule: lower-case collection names)
var Uuid = exports.Uuid = mongoose.model("uuid", mongoose.Schema({}));
var StateChange = exports.StateChange = mongoose.model("statechange", StateChangeMongooseSchema);


// Generic Mongoose helper functions
var createUuid = exports.createUuid = function () {
    return new Uuid()._id;
};


/**
 * ...
 *
 * @param method
 * @param model
 * @param entityId
 * @param changes
 * @param user
 * @returns {StateChange} object
 * @private
 */
var _createStateChange = function (method, model, entityId, changes, user) {

    // Create state change event
    var change = new StateChange();

    // Create state change event: Meta data
    change.user = user;
    change.timestamp = new Date().getTime();
    change.method = method;
    change.type = model.modelName;
    change.entityId = change.method === "CREATE" ? createUuid() : entityId;

    // If an UPDATE, add the changes if given: the domain object changes a.k.a. "the diff"/"the delta"
    if (changes && change.method !== "DELETE") {
        change.changes = changes;
    }

    console.log("State change event created [method=" + change.method + ", type=" + change.type + ", entityId=" + change.entityId + "]");
    return change;
};


/**
 * @returns {Object} Shallow cloned version of given object with all properties prefixed with "value."
 * @private
 */
var _addMapReducePrefixTo = function (obj) {
    var result = {};
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            result["value." + key] = obj[key];
        }
    }
    return result;
};


//////////////////////////////////////
// MapReduce functions
//////////////////////////////////////

/** Mongoose MapReduce :: Map: Group all state change events by entityId */
var _map_groupByEntityId = function () {
    emit(this.entityId, this);
};


/**
 * Mongoose MapReduce :: Reduce: Replay state change events by merging them in the right order
 * 1) Sort all object state change events by timestamp ascending (oldest first and then the newer ones)
 * 2) Check that object first state change event method is a CREATE
 * 3) Abort further processing if the last object state change event method is DELETE (return null)
 * 4) Replay all object state change events (by reducing all the diffs) (abort further processing if one of the state change events being replayed have a method other than UPDATE)
 * 5) Return the "replayed" (collapsed) object
 */
var _reduce_replayStateChangeEvents = function (key, values) {
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
};


/**
 * Mongoose MapReduce :: Finalize/Post-processing:
 * If Reduce phase is bypassed due to a single object state change event,
 * return this single object state change event as the object state.
 */
var _mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects = function (key, reducedValue) {
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
};

// /MapReduce functions


//////////////////////////////////////
// Public event sourcing functions
//////////////////////////////////////

/**
 * ...
 *
 * @param method
 * @param model
 * @param entityId
 * @param changes
 * @param user
 * @returns {StateChange} deferred object
 */
var stateChange = exports.stateChange = function (method, model, entityId, changes, user) {
    var dfd = new promise.Deferred();

    // Create state change event: Meta data
    var change = _createStateChange(method, model, entityId, changes, user);

    // Save it!
    change.save(function (err) {
        if (err) {
            console.warn(err);
            dfd.reject();
            return null;
        }
        console.log("State change event saved ...OK [entityId=" + change.entityId + "]");
        return dfd.resolve(change);
    });
    return dfd.promise;
};


var getStateChangesByEntityId = exports.getStateChangesByEntityId = function (entityId) {
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
};


var _replayStateChangesFor = function (entityId) {
    return getStateChangesByEntityId(entityId).then(function (stateChanges) {
        return _reduce_replayStateChangeEvents(null, stateChanges);
    });
};


var rebuild = exports.rebuild = function (type, entityId) {
    var obj = new type({ _id: entityId });
    obj.set(_replayStateChangesFor(entityId));
    return obj;
};


// TODO: improve and document method signature/API
var count = exports.count = function (type, conditions) {
    var dfd = new promise.Deferred(),
        mapReduceConfig = {
            query: { type: type.modelName },
            map: _map_groupByEntityId,
            reduce: _reduce_replayStateChangeEvents,
            finalize: _mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects,
            out: { replace: "filteredEntities", inline: 1 }
        };

    StateChange.mapReduce(mapReduceConfig, function (err, results) {
        if (err) {
            dfd.reject(err);
            return err;
        }
        return results.count(conditions, function (err, count) {
            if (err) {
                return dfd.reject(err);
            }
            return dfd.resolve(count);
        });
    });
    return dfd.promise;
};


// TODO: improve and document method signature/API
var find = exports.find = function (options) {
    var dfd = new promise.Deferred(),

    // TODO: extract into helper method, located in Map Reduce "area"
        mapReduceConfig = {
            query: { type: options.type.modelName },
            map: _map_groupByEntityId,
            reduce: _reduce_replayStateChangeEvents,
            finalize: _mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects,
            out: { replace: "filteredEntities", inline: 1 }
        };

    StateChange.mapReduce(mapReduceConfig, function (err, results) {
        if (err) {
            dfd.reject(err);
            return err;
        }
        return dfd.resolve(results);
    });
    return dfd.promise;
};


// TODO: improve and document method signature/API
var project = exports.project = function (options) {
    var dfd = new promise.Deferred(),
        mapReduceConfig = {
            query: { type: options.type.modelName },
            map: _map_groupByEntityId,
            reduce: _reduce_replayStateChangeEvents,
            finalize: _mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects,
            out: { replace: "filteredEntities", inline: 1 }
        };

    StateChange.mapReduce(mapReduceConfig, function (err, results) {
        if (err) {
            dfd.reject(err);
            return err;
        }
        return results
            .find(function (err, totalMapReducedResult) {
                var totalResult = totalMapReducedResult.map(function (obj) {
                        return obj.value;
                    }),
                    findConditions = _addMapReducePrefixTo(options.conditions),
                    sortParams = _addMapReducePrefixTo(options.sort);

                return results
                    .find(findConditions)
                    .exec(function (err, projectedResult) {
                        return results
                            .find(findConditions)
                            .sort(sortParams)
                            .skip(options.skip)
                            .limit(options.limit)
                            .exec(function (err, paginatedResult) {
                                var books = paginatedResult.map(function (obj) {
                                    if (obj.value) {
                                        obj.value._id = obj._id;
                                        return obj.value;
                                    }
                                    return null;
                                });
                                return dfd.resolve({ books: books, count: projectedResult.length, totalCount: totalResult.length });
                            }
                        );
                    }
                );
            }
        );
    });
    return dfd.promise;
};
