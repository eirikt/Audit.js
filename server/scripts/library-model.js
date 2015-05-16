var mongoose = require("mongoose"),
    promise = require("promised-io/promise"),
    utils = require("./utils"),


// Mongoose schemas
    KeywordMongooseSchema = new mongoose.Schema({
        keyword: String
    }),

    BookMongooseSchema = new mongoose.Schema({
        seq: Number,

        // TODO: Does indexing help? How to measure it? Can indexes be dynamically added afterwards ...
        title: String,
        //title: { type: String, index: true },

        author: String,
        //author: { type: String, index: true },

        //releaseDate: Date,  // Not yet supported

        //coverImage: String, // Not yet supported

        keywords: [KeywordMongooseSchema]
        //keywords: { type: [KeywordMongooseSchema], index: true }
    }),


// Mongoose models (designated as "entity types" in Audit.js) (design rule: lower-case collection names)
    Keyword = exports.Keyword = mongoose.model("keyword", KeywordMongooseSchema),

    Book = exports.Book = mongoose.model("book", BookMongooseSchema);


Book.collectionName = function () {
    "use strict";
    return Book.modelName + "s".toLowerCase();
};


/*
Book.update = function (id, changes) {
    "use strict";
    var dfd = new promise.Deferred();
    Book.findByIdAndUpdate(id, changes, function (err, book) {
        if (utils.handleError(err, { deferred: dfd })) {
            return null;
        }
        console.log("Book '" + book.title + "' [id=" + book._id + "] updated ...OK");
        return dfd.resolve(book);
    });
    return dfd.promise;
};
*/
Book.update =
    function requestor(callback, stateChanges) {
        'use strict';
        Book.findByIdAndUpdate(stateChanges.entityId, stateChanges, function (err, book) {
            if (err){
                console.error('Updating Book [id=' + stateChanges.entityId + '] failed');
                return callback(undefined, err);
            }
            console.log('Book [id=' + stateChanges.entityId + '] updated ...OK');
            return callback(book, undefined);
        });
    };

Book.remove =
    function requestor(callback, stateChanges) {
        'use strict';
        Book.findByIdAndRemove(stateChanges.entityId, function (err, book) {
            if (err){
                console.error('Removing Book [id=' + stateChanges.entityId + '] failed');
                return callback(undefined, err);
            }
            console.log('Book [id=' + stateChanges.entityId + '] removed ...OK');
            return callback(stateChanges, undefined);
        });
    };
