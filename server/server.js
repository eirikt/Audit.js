// Module dependencies
// https://github.com/mylovecompany/mongoose-pureautoinc
var application_root = __dirname,
    _ = require("underscore"),                              // JavaScript utils
    express = require("express"),                           // Node.js web framework
    path = require("path");                                 // Node.js utilities for dealing with file paths
mongoose = require("mongoose"),                         // Node.js MongoDB driver
    pureautoinc = require("mongoose-pureautoinc"),          // Mongoose autoincrement support
    deferred = require("promised-io/promise").Deferred();   // Node.js deferred implementation

// Create server
var app = express();

// Configure server
app.configure(function () {
    //parses request body and populates request.body
    //app.use(express.bodyParser());

    //checks request.body for HTTP method overrides
    //app.use(express.methodOverride());

    //perform route lookup based on url and HTTP method
    app.use(app.router);

    //Where to serve static content
    app.use(express.static(path.join(application_root, "../client")));

    //Show all errors in development
    //app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// Start server
var port = 4711;
app.listen(port, function () {
    console.log('Express server listening on port %d in %s mode', port, app.settings.env);
});

// Connect to database
var db = mongoose.connect('mongodb://localhost/library');

// Misc. library initializations
pureautoinc.init(db);

// Schemas
var StateChangeMongooseSchema = new mongoose.Schema({
    user: String,
    timestamp: { type: Date, default: Date.now },
    method: String,
    type: String,
    entityId: String,
    changes: {}
});

var KeywordMongooseSchema = new mongoose.Schema({
    keyword: String
});

var BookMongooseSchema = new mongoose.Schema({
    title: String,
    author: String,
    releaseDate: Date,
    coverImage: String,
    keywords: [ KeywordMongooseSchema ],
    dateAdded: Date
});


// Misc. schema config
BookMongooseSchema.plugin(pureautoinc.plugin, {
    model: "BookModel",
    field: "seq",
    start: 1
});

// Models
var StateChangeMongooseModel = mongoose.model("StateChange", StateChangeMongooseSchema);
var KeywordMongooseModel = mongoose.model("Keyword", KeywordMongooseSchema);
var BookMongooseModel = mongoose.model("Book", BookMongooseSchema);


// Helper functions
function getRandomAlphanumericStringOfLength(length) {
    return Math.random().toString(36).substr(2, length);
}

var firstNames = ["Jon", "Asle", "Stig", "Jens-Kåre", "Konrad", "Torstein", "Dag", "Jostein"];
var lastNames = ["Pedersen", "Olsen", "Jensen", "Snøfuglien", "Gaarder", "Solstad"];
var titleElement1 = ["Dawn", "Night", "Sunset", "Nightfall", "Party", "Winter", "Summertime"];
var titleElement2 = ["in", "at", "on"];
var titleElement3 = ["Utopia", "America", "Europe", "Arabia", "Africa"];
var keywords = ["#scifi", "#thriller", "#fantasy", "#debut", "#novel", "#shortstories", "#pageturner", "#blockbuster"];

function pickRandomElementFromArray(array) {
    return array[_.random(array.length - 1)];
}

function insertBook(attrs) {
    var Deferred = require("promised-io/promise").Deferred;
    var dfd = new Deferred();

    // TODO: Consider splitting inserts into pure model creation/meta-data init, and then an ordinary statechange that is immediately replayed into model
    var book = new BookMongooseModel();
    book.set({ title: attrs.title });
    book.set({ author: attrs.author });
    book.set({ releaseDate: attrs.releaseDate });
    var keywords = [];
    _.each(attrs.keywords, function (keyword) {
        keywords.push(new KeywordMongooseModel({ keyword: keyword }));
    });
    book.set({ keywords: keywords });
    book.set({ dateAdded: new Date() });
    //console.log('Book MongoDB BookModel object created ...');

    book.save(function (err) {
        if (err) {
            console.log(err);
            dfd.reject();
            return;
        }
        //console.log("Book '" + book.title + "' saved ...OK [_id=" + book._id + "]");

        var change = new StateChangeMongooseModel();
        change.user = "etorske";
        change.timestamp = new Date().getTime();
        change.method = "CREATE";
        change.type = "BookModel";
        change.entityId = book._id;
        change.changes = attrs;

        change.save(function (err) {
            if (err) {
                console.log(err);
                // TODO: delete book saved just now?
                dfd.reject();
                return;
            }
            //console.log("State change event saved ...OK [entityId=" + change.entityId + "]");
            dfd.resolve(book);
        });
    });
    return dfd.promise;
}


// Route: Admin: Get total number of state changes
app.get("/api/statechangecount", function (request, response) {
    return StateChangeMongooseModel.count(function (err, count) {
        if (!err) {
            return response.send({ count: count });
        } else {
            return console.log(err);
        }
    });
});

// Route: Admin: generating a single random book
app.post("/api/admin/generate-single-random", function (request, response) {
    return insertBook({
        title: pickRandomElementFromArray(titleElement1) + " " + pickRandomElementFromArray(titleElement2) + " " + pickRandomElementFromArray(titleElement3),
        author: pickRandomElementFromArray(firstNames) + " " + pickRandomElementFromArray(lastNames),
        keywords: [pickRandomElementFromArray(keywords), pickRandomElementFromArray(keywords)]
    }).then(function (book) {
            return BookMongooseModel.count(function (err, count) {
                if (err) {
                    return console.log(err);
                } else {
                    return StateChangeMongooseModel.count(function (err, stateChangeCount) {
                        if (err) {
                            return console.log(err);
                        } else {
                            return response.send({
                                book: book,
                                count: count,
                                stateChangeCount: stateChangeCount
                            });
                        }
                    });
                }
            });
        });
});

// Route: Get total number of books
app.get("/api/bookcount", function (request, response) {
    return BookMongooseModel.count(function (err, count) {
        if (!err) {
            return response.send({ count: count });
        } else {
            return console.log(err);
        }
    });
});

// Route: Get all books
app.get("/api/books", function (request, response) {
    return BookMongooseModel.find().sort({ dateAdded: "desc" }).execFind(function (err, books) {
        if (!err) {
            return response.send(books);
        } else {
            return console.log(err);
        }
    });
});

// Route: Insert a new book
app.post("/api/books", function (request, response) {
    if (!request.body) {
        return console.log("request.body is missing");
    }
    return insertBook({
        title: request.body.title,
        author: request.body.author,
        releaseDate: request.body.releaseDate,
        coverImage: request.body.coverImage,
        keywords: request.body.keywords
    }).then(function (book) {
            response.send(book);
        });
});
