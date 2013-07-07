// Module dependencies
var application_root = __dirname,
    _ = require("underscore"),                 // Node.js Underscore version (JavaScript utilities)
    deferred = require("promised-io/promise"), // Node.js 'promise' implementation
    express = require("express"),              // Node.js web server
    path = require("path"),                    // Node.js utilities for dealing with file paths
    mongoose = require("mongoose");            // Node.js MongoDB driver

// Mongoose schemas
var SequenceNumberSchema = new mongoose.Schema({
    seq: { type: Number, default: 1 }
});

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
    seq: Number,
    title: String,
    author: String,
    releaseDate: Date,
    coverImage: String,
    keywords: [ KeywordMongooseSchema ],
    dateAdded: Date
});

// Mongoose models (design rule: lowercase collection names)
var Uuid = mongoose.model("uuid", mongoose.Schema({}));
var Sequence = mongoose.model("sequence", SequenceNumberSchema);
var StateChange = mongoose.model("statechange", StateChangeMongooseSchema);
var Keyword = mongoose.model("keyword", KeywordMongooseSchema);
var Book = mongoose.model("book", BookMongooseSchema);
Book.collectionName = function () {
    return Book.modelName + "s".toLowerCase();
};


// Helper functions
function createUuid() {
    return new Uuid()._id;
}

function incrementSequenceNumber(schemaName, callback) {
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

function getRandomAlphanumericStringOfLength(length) {
    return Math.random().toString(36).substr(2, length);
}

// Data elements to be randomly picked
var users = ["eric", "ann", "tim", "jeff", "liz", "paul"];

var firstNames = ["Jon", "Asle", "Stig", "Jens-Kåre", "Konrad", "Torstein", "Anne", "Dag", "Jostein"];
var lastNames = ["Pedersen", "Olsen", "Jensen", "Snøfuglien", "Gaarder", "Holt", "Solstad"];
var titleElement1 = ["Dawn", "Night", "Sunset", "Nightfall", "Party", "Winter", "Summertime", "Apocalypse", "Journey"];
var titleElement2 = ["in", "of", "on", "under", "to"];
var titleElement3 = ["Earth", "Mars", "Andromeda", "Utopia", "Antarctica", "America", "Europe", "Africa", "Asia", "Oceania"];
var keywords = ["#scifi", "#thriller", "#fantasy", "#debut", "#novel", "#shortstories", "#pageturner", "#blockbuster", "#rollercoaster"];

function pickRandomElementFrom(array) {
    return array[_.random(array.length - 1)];
}

function count(model) {
    var dfd = new deferred.Deferred();
    model.count(function (error, count) {
        if (error) {
            dfd.reject();
        }
        dfd.resolve(count)
    });
    return dfd.promise;
}

function createAndSaveStateChange(deferred, model, delta, createAndSaveApplicationObjectFunction) {
    // Create state change event
    var change = new StateChange();

    // Create state change event: Meta data
    change.user = pickRandomElementFrom(users);
    change.timestamp = new Date().getTime();
    change.method = "CREATE";
    change.type = model.modelName;
    change.entityId = createUuid();

    // Create state change event: "The diff"
    change.changes = delta;

    change.save(function (err) {
        if (err) {
            console.log(err);
            deferred.reject();
            return null;
        }
        console.log("State change event saved ...OK [entityId=" + change.entityId + "]");
        return createAndSaveApplicationObjectFunction(deferred, change);
    });
    return deferred.promise;
}

function createAndSaveBook(deferred, bookAttributes) {
    var book = new Book({ _id: bookAttributes.entityId });

    // Special treatment: Embedded models: Keyword
    var keywords = _.map(bookAttributes.changes.keywords, function (keyword) {
        return new Keyword({ keyword: keyword });
    });
    book.set({ keywords: keywords });
    delete bookAttributes.changes.keywords;

    // Add the rest of the properties
    book.set(bookAttributes.changes);

    book.save(function (err) {
        if (err) {
            console.log(err);
            deferred.reject();
            return;
        }
        console.log("Book '" + book.title + "' saved ...OK [_id=" + book._id + "]");
        deferred.resolve(book);
    });
    return deferred.promise;
}

function createBook(bookAttributes) {
    var dfd = new deferred.Deferred();
    incrementSequenceNumber(Book.collectionName(), function (error, nextSequence) {
        if (error) {
            console.warn(error);
            dfd.reject(error);
            return null;
        }
        bookAttributes.seq = nextSequence;
        bookAttributes.dateAdded = new Date();
        // TODO: Consider promise instead of 'createAndSaveBook' callback here
        return createAndSaveStateChange(dfd, Book, bookAttributes, createAndSaveBook);
    });
    return dfd.promise;
}


// Create server
var app = express();

// Configure server
app.configure(function () {
    // Parses request body and populates request.body
    app.use(express.bodyParser());

    // Checks request.body for HTTP method overrides
    app.use(express.methodOverride());

    // Perform route lookup based on url and HTTP method
    app.use(app.router);

    // Where to serve static content
    app.use(express.static(path.join(application_root, "../client")));

    // Show all errors in development
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// Start server
var port = 4711;
app.listen(port, function () {
    console.log('Express server listening on port %d in %s mode', port, app.settings.env);
});

// Connect to database
/*var db = */
mongoose.connect("mongodb://localhost/library", {}, function (error, db) {
    if (error) {
        console.warn(error);
        throw new Error(error);
    }
    //this.db = db;
});


// Route: Admin API: Get total number of state changes
app.get("/api/admin/statechangecount", function (request, response) {
    return count(StateChange).then(function (count) {
        return response.send({ count: count });
    })
});


// Route: Admin API: generating a single random book
app.post("/api/admin/generate-single-random", function (request, response) {
    return createBook({
        title: pickRandomElementFrom(titleElement1) + " " + pickRandomElementFrom(titleElement2) + " " + pickRandomElementFrom(titleElement3),
        author: pickRandomElementFrom(firstNames) + " " + pickRandomElementFrom(lastNames),
        keywords: [pickRandomElementFrom(keywords), pickRandomElementFrom(keywords)]
    }).then(function (book) {
            // TODO: create a deferred function for this
            return Book.count(function (error, count) {
                if (error) {
                    return console.warn(error);
                } else {
                    // TODO: create a deferred function for this
                    return StateChange.count(function (error, stateChangeCount) {
                        if (error) {
                            return console.warn(err);
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
        }, function (error) {
            return response.send({
                error: error.message
            });
        });
});


// Routes: Admin API: purge all Book models in MongoDB store
app.post("/api/admin/purge", function (request, response) {
    return mongoose.connection.collections[Book.collectionName()].drop(function (error) {
        if (error) {
            // TODO: ...
            console.warn(error);
            return response.send("Book collection dropped!");
        } else {
            console.log("Book collection dropped!");
            return response.send("Book collection dropped!");
        }
    });
});


// Routes: Admin API: replaying of change log
app.post("/api/admin/replay", function (request, response) {
    console.log("Replaying entire change log ...");
    return StateChange.find().sort({ timestamp: "asc"}).execFind(function (error, stateChanges) {
        if (error) {
            return console.warn(error);
        }
        var replay = function (stateChanges, index) {
            var stateChange = stateChanges[index];
            if (stateChange) {

                if (stateChange.type === Book.modelName) {
                    switch (stateChange.method) {

                        case "CREATE":
                            return Book.findById(stateChange.entityId, { /*slim: true*/ }, function (err, book) {
                                if (book) {
                                    console.log("Replaying books CREATE [" + index + "]: Book #" + book.seq + " \"" + book.title + "\" already present! {_id:" + book._id + "}");
                                    if (index < stateChanges.length - 1) {
                                        return replay(stateChanges, ++index);
                                    } else {
                                        console.log("Replaying books CREATE: DONE!");
                                        return response.send("Replaying books DONE!" + ++index + " books recreated");
                                    }
                                } else {
                                    return createAndSaveBook(new deferred.Deferred, stateChange).then(function () {
                                        // Replay next state change event ...
                                        if (index < stateChanges.length - 1) {
                                            return replay(stateChanges, ++index);
                                        } else {
                                            console.log("Replaying books CREATE: DONE!");
                                            return response.send("Replaying books DONE!" + ++index + " books recreated");
                                        }
                                    });
                                }
                            });
                            break;

                        case "UPDATE":
                            throw new Error("Replaying: Not implemented yet ...");
                            break;

                        case "DELETE":
                            throw new Error("Replaying: Not implemented yet ...");
                            break;

                        default:
                            throw new Error("Replaying: Unknown state change method: " + stateChange.method);
                            break;
                    }
                } else {
                    throw new Error("Replaying: Not supported/Not implemented yet/Unknown model: " + stateChange.type);
                }
            }
        };
        // Instigate!
        return replay(stateChanges, 0);
    });
});


// Route: Library API: Get total number of books
app.get("/api/bookcount", function (request, response) {
    return count(Book).then(function (count) {
        return response.send({ count: count });
    })
});


// Route: Library API: Get all books
app.get("/api/books", function (request, response) {
    return Book.find().sort({ seq: "asc" }).execFind(function (error, books) {
        if (error) {
            return console.warn(error);
        }
        return response.send(books);
    });
});
