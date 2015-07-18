var __ = require('underscore'),
    mongoose = require('mongoose'),
    utils = require('./utils'),
    libraryModels = require('./library-model'),


///////////////////////////////////////////////////////////////////////////////
// Mongoose schemas
///////////////////////////////////////////////////////////////////////////////

    TagMongooseSchema = new mongoose.Schema(new libraryModels.ImmutableTag(String)),

//targetModelDescriptor = ['sequenceNumber'],
//bookCoreModelDescriptor = cloneAndExtendArray(targetModelDescriptor, ['title', 'author', 'tags']),
    BookMongooseSchema = new mongoose.Schema(new libraryModels.ImmutableBook(Number, String, String, String, [TagMongooseSchema])),
//BookMongooseSchema = new mongoose.Schema(new ImmutableBook(
//    // TODO: Check out detailed configuration: http://mongoosejs.com/docs/guide.html
//    { type: Number, index: true, required: true },
//    { type: String, index: true, required: false },
//    { type: String, index: true, required: false },
//    { type: [TagMongooseSchema], index: true, required: false }
//)),

//contextModelDescriptor = ['sequenceNumber', 'originator', 'fromDate', 'toDate', 'location', 'resources'],
//libraryVisitCoreModelDescriptor = cloneAndExtendArray(contextModelDescriptor, ['user', 'loanPeriodInDays']),
    VisitMongooseSchema = new mongoose.Schema(new libraryModels.ImmutableVisit(Number, String, mongoose.Schema.ObjectId, Date, Date, String, String, String, Number)),
//    VisitMongooseSchema = new mongoose.Schema(new libraryModels.ImmutableVisit(
//        { type: Number, index: true, required: true },
//        { type: String, index: true, required: true },
//        { type: Date, index: true, required: true },
//        { type: Number, index: true, required: false },
//// See: http://stackoverflow.com/questions/14796962/mongoose-schema-reference
//        [{ type: mongoose.Schema.ObjectId, ref: 'LoanMongooseSchema', index: true, required: false }]
//    )),

//actionModelDescriptor = ['sequenceNumber', 'context', 'target', 'originator', 'date'],
//bookLoanCoreModelDescriptor = cloneAndExtendArray(actionModelDescriptor, ['book', 'libraryVisit', 'returnDate']),
    LoanMongooseSchema = new mongoose.Schema(new libraryModels.ImmutableLoan(
        Number,
        {
            type: mongoose.Schema.ObjectId,
            ref: 'VisitMongooseSchema',
            index: true,
            required: true
        },
        String,
        {
            type: mongoose.Schema.ObjectId,
            ref: 'BookMongooseSchema',
            index: true,
            required: true
        },
        mongoose.Schema.ObjectId,
        String,
        Date,
        Date)),
//LoanMongooseSchema = new mongoose.Schema(new libraryModels.ImmutableLoan(
//    { type: Number, index: true, required: true },
//    { type: mongoose.Schema.ObjectId, ref: 'BookMongooseSchema', index: true, required: true },
//    { type: mongoose.Schema.ObjectId, ref: 'VisitMongooseSchema', index: true, required: true },
//    { type: Date, index: false, required: false }
//)),


///////////////////////////////////////////////////////////////////////////////
// Mongoose Library models (designated as 'entity types' in Audit.js)
// (design rule: lower-case collection names)
// TODO: Are these worthy of the pure no-suffix designation (e.g. 'Book'), or should these be called e.g. 'BookMongooseModel'/'MongooseBook'?
///////////////////////////////////////////////////////////////////////////////

    Tag = exports.Tag = mongoose.model('tag', TagMongooseSchema),

    Book = exports.Book = mongoose.model('book', BookMongooseSchema),

    Visit = exports.Visit = mongoose.model('visit', VisitMongooseSchema),

    Loan = exports.Loan = mongoose.model('loan', LoanMongooseSchema),

    getStandardLoanPeriodInDays = exports.getStandardLoanPeriodInDays = function () {
        'use strict';
        return 30;
    };


// TODO: Relocate these (check out detailed configuration: http://mongoosejs.com/docs/guide.html)
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

            // TODO: Should have been like this, but requires full Book stub to be established in 'library-service-api.spec.js' and maybe others ...
            //console.log('Book [id=' + book._id + '] updated ...OK');
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

            // TODO: Should have been like this, but requires full Book stub to be established in 'library-service-api.spec.js' and maybe others ...
            //console.log('Book [id=' + book._id + '] removed ...OK');
            console.log('Book [id=' + entityId + '] removed ...OK');

            return callback(entityId, undefined);
        });
    };
