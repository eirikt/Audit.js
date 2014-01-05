mongoose = require("mongoose");

var SequenceNumberMongooseSchema = exports.SequenceNumberMongooseSchema = new mongoose.Schema({
    seq: { type: Number, default: 1 }
});

var Sequence = exports.Sequence = mongoose.model("sequence", SequenceNumberMongooseSchema);

var incrementSequenceNumber = exports.incrementSequenceNumber = function (schemaName, callback) {
    Sequence.collection.findAndModify(
        { _id: schemaName },
        [],
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
        function (err, result) {
            if (err) {
                callback(err);
            } else {
                callback(null, result.seq);
            }
        }
    );
};
