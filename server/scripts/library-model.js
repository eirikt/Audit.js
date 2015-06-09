var mongoose = require('mongoose'),
    utils = require("./utils"),
    curry = require("./fun").curry,


///////////////////////////////////////////////////////////////////////////////
// Library models
///////////////////////////////////////////////////////////////////////////////

    tagModelDescriptor = ['tag'],
    bookModelDescriptor = ['seq', 'title', 'author', 'tags'], // 'releaseDate' and 'coverImage' not yet supported
    visitModelDescriptor = ['user', 'fromDate', 'period', 'loans'],
    loanModelDescriptor = ['book', 'visit'],

    ImmutableTag = curry(utils.ImmutableObject, tagModelDescriptor),
    ImmutableBook = curry(utils.ImmutableObject, bookModelDescriptor),
    ImmutableVisit = curry(utils.ImmutableObject, visitModelDescriptor),
    ImmutableLoan = curry(utils.ImmutableObject, loanModelDescriptor),

    MutableTag = curry(utils.MutableObject, tagModelDescriptor),
    MutableBook = curry(utils.MutableObject, bookModelDescriptor),
    MutableVisit = curry(utils.MutableObject, visitModelDescriptor),
    MutableLoan = curry(utils.MutableObject, loanModelDescriptor),


// TODO: Move stuff below to 'library-model.mongoose.js'?

///////////////////////////////////////////////////////////////////////////////
// Mongoose schemas
///////////////////////////////////////////////////////////////////////////////

    TagMongooseSchema = new mongoose.Schema(new ImmutableTag(String)),

    BookMongooseSchema = new mongoose.Schema(new ImmutableBook(Number, String, String, [TagMongooseSchema])),
//BookMongooseSchema = new mongoose.Schema(new ImmutableBook(
//    // TODO: Does indexing help? How to measure it? Can indexes be dynamically added afterwards ...
//    { type: Number, index: true, required: true },
//    { type: String, index: true, required: false },
//    { type: String, index: true, required: false },
//    { type: [TagMongooseSchema], index: true, required: false }
//)),

// See: http://stackoverflow.com/questions/14796962/mongoose-schema-reference
    VisitMongooseSchema = new mongoose.Schema(new ImmutableVisit(
        { type: String, index: true, required: true },
        { type: Date, index: true, required: true },
        { type: Number, index: true, required: false },
        [{ type: mongoose.Schema.ObjectId, ref: 'LoanMongooseSchema', index: true, required: false }]
    )),

    LoanMongooseSchema = new mongoose.Schema(new ImmutableLoan(
        { type: mongoose.Schema.ObjectId, ref: 'BookMongooseSchema', index: true, required: true },
        { type: mongoose.Schema.ObjectId, ref: 'VisitMongooseSchema', index: true, required: true }
    )),


///////////////////////////////////////////////////////////////////////////////
// Mongoose Library models (designated as "entity types" in Audit.js)
// (design rule: lower-case collection names)
// TODO: Are these worthy of the pure no-suffix designation (e.g. 'Book'), or should these be called e.g. 'BookMongooseModel'/'MongooseBook'?
///////////////////////////////////////////////////////////////////////////////

    Tag = exports.Tag = mongoose.model('tag', TagMongooseSchema),

    Book = exports.Book = mongoose.model('book', BookMongooseSchema),

    Visit = exports.Visit = mongoose.model('visit', VisitMongooseSchema),

    Loan = exports.Loan = mongoose.model('loan', LoanMongooseSchema);


Book.collectionName = function () {
    'use strict';
    return Book.modelName + 's'.toLowerCase();
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
