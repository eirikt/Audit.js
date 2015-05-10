/* global JSON:false */

var mongoose = require('mongoose'),


///////////////////////////////////////////////////////////////////////////////
// Schemas
///////////////////////////////////////////////////////////////////////////////

    /**
     *
     */
    StateChangeMongooseSchema = exports.StateChangeMongooseSchema = new mongoose.Schema({
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
    }),


///////////////////////////////////////////////////////////////////////////////
// Models
///////////////////////////////////////////////////////////////////////////////

    /**
     *
     */
    Uuid = exports.Uuid = mongoose.model('uuid', mongoose.Schema({})),

    /**
     *
     */
    StateChange = exports.StateChange = mongoose.model('statechange', StateChangeMongooseSchema);
