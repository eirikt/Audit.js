/* jshint -W024 */
var mongoose = require('mongoose'),

    SequenceNumberMongooseSchema = exports.SequenceNumberMongooseSchema = new mongoose.Schema({
        seq: { type: Number, default: 1 }
    }),

    Sequence = exports.Sequence = mongoose.model('sequence', SequenceNumberMongooseSchema),

    incrementSequenceNumber = exports.incrementSequenceNumber = function (schemaName, callback) {
        'use strict';
        Sequence.collection.findAndModify(
            { _id: schemaName },
            [],
            { $inc: { sequenceNumber: 1 } },
            { new: true, upsert: true },
            function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, result.value.sequenceNumber);
                }
            }
        );
    },

    incrementNumberOfUnusedSequenceNumbers = exports.incrementUnusedSequenceNumbers = function (schemaName, callback) {
        'use strict';
        Sequence.collection.findAndModify(
            { _id: schemaName },
            [],
            { $inc: { unused: 1 } },
            { new: true, upsert: true },
            function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, result.value.unused);
                }
            }
        );
    },

    getSequenceNumber = exports.getSequenceNumber = function (schemaName, callback) {
        'use strict';
        Sequence.collection.findOne({ _id: schemaName }, function (err, sequenceCollection) {
            if (err) {
                callback(err);
            } else {
                if (sequenceCollection) {
                    callback(null, sequenceCollection.sequenceNumber);
                } else {
                    callback(null, 0);
                }
            }
        });
    },

    getNumberOfUnusedSequenceNumbers = exports.getUnused = function (schemaName, callback) {
        'use strict';
        Sequence.collection.findOne({ _id: schemaName }, function (err, sequenceCollection) {
            if (err) {
                callback(err);
            } else {
                if (sequenceCollection) {
                    callback(null, sequenceCollection.unused);
                } else {
                    callback(null, 0);
                }
            }
        });
    },


    getSequenceNumberMinusUnusedOnes = exports.getNumberOfActiveSequenceNumbers = function (schemaName, callback) {
        'use strict';
        Sequence.collection.findOne({ _id: schemaName }, function (err, sequenceCollection) {
            if (err) {
                callback(err);
            } else {
                if (sequenceCollection) {
                    var sequenceNumber = sequenceCollection.sequenceNumber || 0,
                        numberOfUnusedSequenceNumbers = sequenceCollection.unused || 0;
                    callback(null, sequenceNumber - numberOfUnusedSequenceNumbers);
                } else {
                    callback(null, 0);
                }
            }
        });
    };
