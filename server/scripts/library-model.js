/* global JSON:false */
/* jshint -W024 */

// Module dependencies, external
var applicationRoot = __dirname,
    bodyParser = require('body-parser'),
    path = require('path'),

    mongodb = require("mongodb"),
    mongoose = require("mongoose"),

    promise = require("promised-io/promise"),
    all = promise.all,
    seq = promise.seq,

    RQ = require("async-rq"),
    rq = require("rq-essentials"),
    sequence = RQ.sequence,
    fallback = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,
    then = rq.then,
    continueIf = rq.if,
    go = rq.execute,

    _ = require("underscore"),


// Module dependencies, local
    curry = require("./fun").curry,
    error = require("./error"),
    randomBooks = require("./random-books"),
    eventSourcingService = require("./eventsourcing-service-api"),
    cqrsService = require("./cqrs-service-api"),
//libraryService = require("./library-service-api"),
    eventSourcing = require("./mongoose.event-sourcing"),


// MongoDB URL
    dbUrl = "mongodb://localhost/library",


// Mongoose schemas
    KeywordMongooseSchema = new mongoose.Schema({
        keyword: String
    }),

    BookMongooseSchema = new mongoose.Schema({
        seq: Number,
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


Book.update = function (id, changes) {
    "use strict";
    var dfd = new promise.Deferred();
    Book.findByIdAndUpdate(id, changes, function (err, book) {
        if (error.handle(err, { deferred: dfd })) {
            return null;
        }
        console.log("Book '" + book.title + "' [id=" + book._id + "] updated ...OK");
        return dfd.resolve(book);
    });
    return dfd.promise;
};


Book.remove = function (id) {
    "use strict";
    var dfd = new promise.Deferred();
    Book.findByIdAndRemove(id, function (err) {
        if (!error.handle(err, { deferred: dfd })) {
            console.log("Book [id=" + id + "] deleted ...OK");
            dfd.resolve(id);
        }
    });
    return dfd.promise;
};
