/* global JSON:false */

var mongoose = require('mongoose'),


///////////////////////////////////////////////////////////////////////////////
// Schemas
///////////////////////////////////////////////////////////////////////////////

    /**
     * ...
     */
    StateChangeMongooseSchema = exports.StateChangeMongooseSchema = new mongoose.Schema({

        // TODO: Does indexing help? How to measure it? Can indexes be dynamically added afterwards ...
        user: String,
        //user: { type: String, index: true },

        timestamp: Date,
        //timestamp: { type: Date, default: Date.now }, // Possible, yes, but less maintainable code

        method: String,
        //method: { type: String, index: true },

        type: String,
        //type: { type: String, index: true },

        entityId: String,
        //entityId: { type: String, index: true },

        changes: Object
    }),


///////////////////////////////////////////////////////////////////////////////
// Models
///////////////////////////////////////////////////////////////////////////////

    /**
     * ...
     */
    Uuid = exports.Uuid = mongoose.model('uuid', mongoose.Schema({})),

    /**
     * ...
     */
    StateChange = exports.StateChange = mongoose.model('statechange', StateChangeMongooseSchema),


///////////////////////////////////////////////////////////////////////////////
// Helper functions
///////////////////////////////////////////////////////////////////////////////

    _createMongooseIdObject = exports.createMongooseIdObject =
        function (entityId) {
            'use strict';
            var IdModel = mongoose.model('_id', mongoose.Schema({})),
                id = new IdModel();

            id._id = entityId;

            return id;
        },


    _eventSourcedEntityExists = exports.entityExists = function (stateChanges) {
        'use strict';
        return stateChanges && stateChanges[stateChanges.length - 1].method !== 'DELETE';
    },


    _notEventSourcedEntityExists = exports.notEntityExists = function (stateChanges) {
        'use strict';
        return !_eventSourcedEntityExists(stateChanges);
    };
