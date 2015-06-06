var mongoose = require("mongoose"),
    promise = require("promised-io/promise"),
    utils = require("./utils"),


// Mongoose schemas
    TagMongooseSchema = new mongoose.Schema({
        tag: String
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

        tags: [TagMongooseSchema]
        //keywords: { type: [KeywordMongooseSchema], index: true }
    }),


// Mongoose models (designated as "entity types" in Audit.js) (design rule: lower-case collection names)
    Tag = exports.Tag = mongoose.model("tag", TagMongooseSchema),

    Book = exports.Book = mongoose.model("book", BookMongooseSchema);


// TODO: Move these to 'library-application-store.mongodb.js'??
Book.collectionName = function () {
    "use strict";
    return Book.modelName + "s".toLowerCase();
};


Book.update =
    function requestor(callback, updatedBook) {
        'use strict';
        Book.findByIdAndUpdate(updatedBook._id, updatedBook, function (err, book) {
            if (err){
                console.error('Updating Book [id=' + updatedBook._id + '] failed [' + err.name + ':' + err.message + ']');
                return callback(undefined, err);
            }
            console.log('Book [id=' + updatedBook._id + '] updated ...OK');
            return callback(book, undefined);
        });
    };


Book.remove =
    function requestor(callback, entityId) {
        'use strict';
        Book.findByIdAndRemove(entityId, function (err, book) {
            if (err){
                console.error('Removing Book [id=' + entityId + '] failed');
                return callback(undefined, err);
            }
            console.log('Book [id=' + book._id + '] removed ...OK');
            return callback(entityId, undefined);
        });
    };
