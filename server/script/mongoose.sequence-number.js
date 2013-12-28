mongoose = require("mongoose");


// Mongoose schema
var SequenceNumberMongooseSchema = exports.SequenceNumberMongooseSchema = new mongoose.Schema({
    seq: { type: Number, default: 1 }
});


// Mongoose model
var Sequence = exports.Sequence = mongoose.model("sequence", SequenceNumberMongooseSchema);


var incrementSequenceNumber = exports.incrementSequenceNumber = function (schemaName, callback) {
    Sequence.collection.findAndModify(
        { _id: schemaName },
        [],
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
        function (error, result) {
            if (error) {
                callback(error);
            } else {
                callback(null, result.seq);
            }
        }
    );
}