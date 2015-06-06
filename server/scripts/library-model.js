var mongoose = require('mongoose'),
    utils = require("./utils"),
    curry = require("./fun").curry,

// TODO: Move to 'utils.js'
    arrayToObject = function (arr) {
        'use strict';
        var obj = {};
        arr.forEach(function (element) {
            obj[element] = null;
        });
        return obj;
    },

    ImmutableObject = function () {
        'use strict';
        var self = this,
            arrayModel = arguments[0],
            propertyDescriptors = Array.prototype.slice.call(arguments, 1);

        // TODO: Any possibilities including support for missing 'new' when calling constructor functions here?
        //if (!(this instanceof BookModel)) {
        //    return new BookModel(arguments);
        //}
        arrayModel.forEach(function (element, index, array) {
            Object.defineProperty(self, element, utils.immutablePropertyWithDefaultValue(propertyDescriptors[index]));
        });
        Object.seal(self);
        return this;
    },


///////////////////////////////////////////////////////////////////////////////
// Library models
///////////////////////////////////////////////////////////////////////////////

    primordialBook = ['seq', 'title', 'author', 'tags'], // 'releaseDate' and 'coverImage' not yet supported
    primordialTag = ['tag'],

//basicBook = arrayToObject(primordialBook),

    BookModel = curry(ImmutableObject, primordialBook),
    TagModel = curry(ImmutableObject, primordialTag),


///////////////////////////////////////////////////////////////////////////////
// Mongoose schemas
///////////////////////////////////////////////////////////////////////////////

    TagMongooseSchema = new mongoose.Schema(new TagModel(String)),
    BookMongooseSchema = new mongoose.Schema(new BookModel(Number, String, String, [TagMongooseSchema])),
// TODO: Does indexing help? How to measure it? Can indexes be dynamically added afterwards ...
//BookMongooseSchema = new mongoose.Schema(
//    new BookModel(
//        { type: Number},
//        { type: String, index: true },
//        { type: String, index: true },
//        { type: [TagMongooseSchema], index: true }
//    )),


///////////////////////////////////////////////////////////////////////////////
// Mongoose Library models (designated as "entity types" in Audit.js)
// (design rule: lower-case collection names)
// TODO: Are these worthy of the no-suffix designation (e.g. 'Book'), or should these be called e.g. 'BookMongooseModel'/'MongooseBook'?
///////////////////////////////////////////////////////////////////////////////

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
            if (err) {
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
            if (err) {
                console.error('Removing Book [id=' + entityId + '] failed');
                return callback(undefined, err);
            }
            console.log('Book [id=' + book._id + '] removed ...OK');
            return callback(entityId, undefined);
        });
    };
