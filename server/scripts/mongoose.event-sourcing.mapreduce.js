/* global JSON:false, emit:false */
/* jshint -W106 */
var _ = require('underscore'),
    promise = require('promised-io/promise'),
    mongoose = require('mongoose'),

    RQ = require('async-rq'),
    rq = require('rq-essentials'),
    sequence = RQ.sequence,
    fallback = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,
    then = rq.then,
    cancel = rq.cancel,
    go = rq.execute,
    mongooseQueryInvocation = rq.mongooseQueryInvocation,

    sequenceNumber = require('./mongoose.sequence-number.js'),
    curry = require('./fun').curry,
    utils = require('./utils.js'),
    mongodbMapreduceStatisticsEmitter = require('./mongodb.mapreduce-emitter'),
    mongooseEventSourcingModels = require('./mongoose.event-sourcing.model'),


//////////////////////////////////////
// MapReduce functions
//////////////////////////////////////

    /**
     * Mongoose MapReduce :: Reduce: Replay state change events by merging them in the right order
     * 1) Sort all object state change events by timestamp ascending (oldest first and then the newer ones)
     * 2) Check that object first state change event method is a CREATE
     * 3) Abort further processing if the last object state change event method is DELETE (return null)
     * 4) Replay all object state change events (by reducing all the diffs) (abort further processing if one of the state change events being replayed have a method other than UPDATE)
     * 5) Return the "replayed" (collapsed) object
     * @private
     */
    _reduce_replayStateChangeEvents = exports._reduce_replayStateChangeEvents =
        function (key, values) {
            'use strict';
            var sortedStateChanges = values.sort(function (a, b) {
                return a.timestamp > b.timestamp;
            });
            if (sortedStateChanges[0].method !== 'CREATE') {
                throw new Error('First event for book with id=' + key + ' is not a CREATE event, rather a ' + sortedStateChanges[0].method + ' (' + JSON.stringify(sortedStateChanges[0]) + '\n');
            }
            if (sortedStateChanges[sortedStateChanges.length - 1].method === 'DELETE') {
                return null;
            }
            var retVal = {};
            sortedStateChanges.forEach(function (stateChange, index) {
                if (index > 0 && stateChange.method !== 'UPDATE') {
                    throw new Error('Expected UPDATE event, was ' + stateChange.method + '\n');
                }
                for (var key in stateChange.changes) {
                    if (stateChange.changes.hasOwnProperty(key)) {
                        retVal[key] = stateChange.changes[key];
                    }
                }
            });
            return retVal;
        },


    /**
     * Mongoose MapReduce :: Finalize/Post-processing:
     * If Reduce phase is bypassed due to a single object state change event,
     * then return this single object state change event as the object state.
     * @private
     */
    _mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects = exports._mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects =
        function (key, reducedValue) {
            'use strict';
            // TODO: move this to StateChange definition
            var isStateChange = function (obj) {
                // TODO: how to include external references inside mapreduce functions ...
                // -> http://stackoverflow.com/questions/7273379/how-to-use-variables-in-mongodb-map-reduce-map-function
                return obj && obj.changes /*&& _.isObject(obj.changes)*/;
            };
            if (reducedValue) {
                return isStateChange(reducedValue) ? reducedValue.changes : reducedValue;
            }
            return null;
        },


    /**
     * Mongoose MapReduce :: Map: Group all state change events by entityId
     * @private
     */
    _map_groupByEntityId = exports._map_groupByEntityId =
        function () {
            'use strict';
            emit(this.entityId, this);
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
     * Of given type, map by entity id, and reduce all state change events by replaying them.
     *
     * @param entityType Mongoose model type
     * @returns Mongoose MapReduce configuration object
     * @private
     */
    _getMapReduceConfigOfType =
        function (entityType) {
            'use strict';
            return {
                query: { type: entityType.modelName },
                map: _map_groupByEntityId,
                reduce: _reduce_replayStateChangeEvents,
                finalize: _mapReduceFinalize_roundUpNonReducedSingleStateChangeEventObjects,
                out: { replace: 'filteredEntities', inline: 1 }
            };
        },


//////////////////////////////////////
// Private event sourcing functions
//////////////////////////////////////

    /**
     * Retrieves all entities of given type by map-reducing all state change state entities.
     *
     * @param entityType Mongoose model type
     * @private
     */
    _mapreducefind = exports.find =
        function (entityType) {
            'use strict';
            //console.log('3!');
            return function requestor(callback, args) {
                //console.log('4!');
                mongooseEventSourcingModels.StateChange.mapReduce(_getMapReduceConfigOfType(entityType), function (err, results) {
                    if (err) {
                        if (err.message === "ns doesn't exist") {
                            console.log(err.name + ' :: ' + err.message + ' - probably empty database, continuing ...');
                            // Special treatment: empty cursor means empty database ...
                            return callback({}, undefined);
                        } else {
                            console.error(err.name + ' :: ' + err.message);
                            return callback(undefined, err);
                        }
                    }
                    // TODO: how to filter out null objects in mapreduce step?
                    // Removing deleted entities => value set to null in reduce step above
                    return callback(results.find({ value: { '$ne': null } }), undefined);
                });
            };
        };
