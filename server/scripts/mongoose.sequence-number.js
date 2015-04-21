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
            { $inc: { seq: 1 } },
            { new: true, upsert: true },
            function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    callback(null, result.value.seq);
                }
            }
        );
    };
