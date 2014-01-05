// Module dependencies, external
var _ = require("underscore"),
    promise = require("promised-io/promise"),
    mongoose = require("mongoose");


// Mongoose schemas
var StateChangeMongooseSchema = exports.StateChangeMongooseSchema = new mongoose.Schema({
    user: String,
    timestamp: Date,
    //timestamp: { type: Date, default: Date.now }, // Possible, yes, but less maintainable code
    method: String,
    type: String,
    entityId: String,
    changes: {}
});
// TODO: verify the effect of this ...
// Indexed 'entityId' for quick grouping
//StateChangeMongooseSchema.index({ entityId: 1 }, { unique: false });


// Mongoose models (design rule: lower-case collection names)
var Uuid = exports.Uuid = mongoose.model("uuid", mongoose.Schema({}));
var StateChange = exports.StateChange = mongoose.model("statechange", StateChangeMongooseSchema);


// Generic Mongoose helper functions
var createUuid = exports.createUuid = function () {
    return new Uuid()._id;
};


// Generic state versioning functions

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


var replayStateChangesFor = exports.replayStateChangesFor = function (entityId) {
    return getStateChangesByEntityId(entityId).then(function (stateChanges) {
        return reduce_replayStateChangeEvents(null, stateChanges);
    });
};


var rebuild = exports.rebuild = function (type, entityId) {
    var obj = new type({ _id: entityId });
    obj.set(replayStateChangesFor(entityId));
    return obj;
};


var replay = exports.replay = function () {
    new Error("Not yet implemented");
};


// MapReduce functions

/** Mongoose MapReduce :: Map: Group all state change events by entityId */
var map_groupByEntityId = exports.mapReduce_map_groupByEntityId = function () {
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
var reduce_replayStateChangeEvents = exports.mapReduce_reduce_replayStateChangeEvents = function (key, values) {
    // TODO: how to include external references inside mapreduce functions ...
    //return _replayStateChanges(values);
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
var mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects = exports.mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects = function (key, reducedValue) {
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
