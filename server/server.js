// Module dependencies
var application_root = __dirname,
    _ = require("underscore"),
    promise = require("promised-io/promise"),
    path = require("path"),
    socketio = require('socket.io'),
    http = require("http"),
    express = require("express"),
    mongoose = require("mongoose");


// Mongoose schemas
var SequenceNumberSchema = new mongoose.Schema({
    seq: { type: Number, default: 1 }
});

var StateChangeMongooseSchema = new mongoose.Schema({
    user: String,
    //timestamp: { type: Date, default: Date.now }, // Possible, yes, but less maintainable code
    timestamp: Date,
    method: String,
    type: String,
    entityId: { type: String, index: 1 }, // Indexed entity ID for quick grouping
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
    keywords: [ KeywordMongooseSchema ]
});


// Mongoose models (design rule: lower-case collection names)
var Uuid = mongoose.model("uuid", mongoose.Schema({}));
var Sequence = mongoose.model("sequence", SequenceNumberSchema);
var StateChange = mongoose.model("statechange", StateChangeMongooseSchema);
var Keyword = mongoose.model("keyword", KeywordMongooseSchema);
var Book = mongoose.model("book", BookMongooseSchema);
Book.collectionName = function () {
    return Book.modelName + "s".toLowerCase();
};


// Connect to database
/*var db = */
mongoose.connect("mongodb://localhost/library", {}, function (error, db) {
    if (error) {
        console.warn(error);
        throw new Error(error);
    }
    //this.db = db;
});


// Generic helper functions
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
// Generic helper functions


// Generic Mongoose helper functions
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

function count(model) {
    var dfd = new promise.Deferred();
    model.count(function (error, count) {
        if (error) {
            dfd.reject();
        }
        dfd.resolve(count)
    });
    return dfd.promise;
}
// /Generic Mongoose helper functions


// Generic state versioning stuff
function createStateChange(method, model, entityId, options) {
    // Create state change event
    var change = new StateChange();

    // Create state change event: Meta data
    change.user = pickRandomElementFrom(users);
    change.timestamp = new Date().getTime();
    change.method = method;
    change.type = model.modelName;
    change.entityId = change.method === "CREATE" ? createUuid() : entityId;

    // If an UPDATE, add the changes if given
    if (options && options.changes && change.method === "UPDATE") {
        change.changes = options.changes;
    }

    console.log("State change event created [method=" + change.method + ", type=" + change.type + ", entityId=" + change.entityId + "]");
    return change;
}

function createAndSaveStateChange(deferred, model, changes, createAndSaveApplicationObjectFunction) {
    // Create state change event: Meta data
    var change = createStateChange("CREATE", model);

    // Create state change event: The domain object changes a.k.a. "the diff"/"the delta"
    change.changes = changes;

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

function getStateChangesByEntityId(entityId) {
    var dfd = new promise.Deferred();
    StateChange.find({ entityId: entityId })
        .sort({ timestamp: "asc"})
        .execFind(function (error, stateChanges) {
            if (error) {
                return dfd.reject(error);
            }
            return dfd.resolve(stateChanges);
        });
    return dfd.promise;
}
// /Generic state versioning stuff


// Application-specific helper functions
function createKeyword(keyword) {
    return new Keyword({ keyword: keyword });
}

function _createAndSaveBook(deferred, bookAttributes) {
    var book = new Book({ _id: bookAttributes.entityId });

    // Add the rest of the properties, and save the book
    book.set(bookAttributes.changes).save(function (error) {
        if (error) {
            console.warn(error);
            deferred.reject();
            return;
        }
        console.log("Book #" + book.seq + " '" + book.title + "' saved ...OK (ID=" + book._id + ")");
        deferred.resolve(book);
    });
    return deferred.promise;
}

function createBook(bookAttributes) {
    var dfd = new promise.Deferred();
    incrementSequenceNumber(Book.collectionName(), function (error, nextSequence) {
        if (error) {
            console.warn(error);
            dfd.reject(error);
            return null;
        }
        bookAttributes.seq = nextSequence;
        // TODO: Consider promise instead of 'createAndSaveBook' callback here
        return createAndSaveStateChange(dfd, Book, bookAttributes, _createAndSaveBook);
    });
    return dfd.promise;
}

function updateBook(id, changes) {
    var dfd = new promise.Deferred();
    Book.findByIdAndUpdate(id, changes, function (error, book) {
        if (error) {
            console.warn(error);
            dfd.reject(error);
        }
        console.log("Book '" + book.title + "' [id=" + book._id + "] updated ...OK");
        dfd.resolve(book);
    });
    return dfd.promise;
}

function removeBook(id) {
    var dfd = new promise.Deferred();
    Book.findByIdAndRemove(id, function (error) {
        if (error) {
            console.warn(error);
            dfd.reject(error);
        }
        console.log("Book [id=" + id + "] deleted ...OK");
        dfd.resolve(id);
    });
    return dfd.promise;
}
// /Application-specific helper functions


var app = express();
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

var server = http.createServer(app);

var port = 4711;
server.listen(port, function () {
    console.log("Express server listening on port %d in %s mode", port, app.settings.env);
});

var io = socketio.listen(server);
io.sockets.on("connection", function (socket) {
    console.log("Socket.IO: server connection caught ...");
});


// Route: Admin API: Get total number of state changes
app.get("/api/admin/statechangecount", function (request, response) {
    return StateChange.count({ method: "CREATE"}, function (error, createCount) {
        return StateChange.count({ method: "UPDATE"}, function (error, updateCount) {
            return StateChange.count({ method: "DELETE"}, function (error, deleteCount) {
                return response.send({
                    createCount: createCount,
                    updateCount: updateCount,
                    deleteCount: deleteCount,
                    totalCount: createCount + updateCount + deleteCount
                });
            })
        })
    })
});


// Route: Admin API: Get all state changes for a particular entity
app.get("/api/admin/statechanges/:entityId", function (request, response) {
    return getStateChangesByEntityId(request.params.entityId).then(function (stateChanges) {
        return response.send(stateChanges);
    });
});


// Route: Admin API: generating a single random book
app.post("/api/admin/generate-single-random", function (request, response) {
    return createBook({
        title: pickRandomElementFrom(titleElement1) + " " + pickRandomElementFrom(titleElement2) + " " + pickRandomElementFrom(titleElement3),
        author: pickRandomElementFrom(firstNames) + " " + pickRandomElementFrom(lastNames),
        keywords: [createKeyword(pickRandomElementFrom(keywords)), createKeyword(pickRandomElementFrom(keywords))]
    }).then(function (book) {
            // TODO: create a deferred function for this
            return Book.count(function (error, bookCount) {
                if (error) {
                    return console.warn(error);
                } else {
                    return StateChange.count({ method: "CREATE"}, function (error, createCount) {
                        return StateChange.count({ method: "UPDATE"}, function (error, updateCount) {
                            return StateChange.count({ method: "DELETE"}, function (error, deleteCount) {
                                var responseObj = {
                                    book: book,
                                    bookCount: bookCount,
                                    stateChangeCreateCount: createCount,
                                    stateChangeUpdateCount: updateCount,
                                    stateChangeDeleteCount: deleteCount,
                                    stateChangeCount: createCount + updateCount + deleteCount
                                };
                                response.send(responseObj);

                                // Inform all clients
                                return io.sockets.emit("book-added", responseObj);
                            })
                        })
                    })
                }
            });
        }, function (error) {
            return response.send({
                error: error.message
            });
        });
});


// Routes: Admin API: purge the entire application store
app.post("/api/admin/purge", function (request, response) {
    return mongoose.connection.collections[Book.collectionName()].drop(function (error) {
        if (error) {
            console.warn(error);
            return response.send({ error: error });
        } else {
            console.log("Book collection dropped!");
            return response.send("Book collection dropped!");
        }
    });
});


// Routes: Admin API: replay the entire event store into the application store
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
                            return Book.findById(stateChange.entityId, { /*slim: true*/ }, function (error, book) {
                                if (book) {
                                    console.log("Replaying books: CREATE [" + index + "]: Book #" + book.seq + " \"" + book.title + "\" already present! {_id:" + book._id + "}");
                                    if (index < stateChanges.length - 1) {
                                        return replay(stateChanges, ++index);
                                    } else {
                                        console.log("Replaying books DONE!");
                                        return response.send("Replaying books DONE!" + ++index + " book state changes imposed");
                                    }
                                } else {
                                    return _createAndSaveBook(new promise.Deferred, stateChange).then(function () {
                                        // Replay next state change event ...
                                        if (index < stateChanges.length - 1) {
                                            return replay(stateChanges, ++index);
                                        } else {
                                            console.log("Replaying books DONE!");
                                            return response.send("Replaying books DONE!" + ++index + " book state changes imposed");
                                        }
                                    });
                                }
                            });
                            break;

                        case "UPDATE":
                            return Book.findById(stateChange.entityId, function (error, book) {
                                if (!book) {
                                    console.log("Replaying UPDATE [" + index + "]: Book {_id:" + stateChange.entityId + "} does not exist!");
                                    if (index < stateChanges.length - 1) {
                                        return replay(stateChanges, ++index);
                                    } else {
                                        console.log("Replaying books DONE!");
                                        return response.send("Replaying books DONE!" + ++index + " book state changes imposed");
                                    }
                                } else {
                                    return book.update(stateChange.changes, function (error, numberAffected) {
                                        if (error) {
                                            console.warn(error);
                                        } else {
                                            console.log("Replaying UPDATE [" + index + "]: Book \"" + book.title + "\" updated ...OK {_id:" + book._id + "} #changes:" + numberAffected);
                                        }
                                        if (index < stateChanges.length - 1) {
                                            return replay(stateChanges, ++index);
                                        } else {
                                            console.log("Replaying books DONE!");
                                            return response.send("Replaying books DONE!" + ++index + " book state changes imposed");
                                        }
                                    });
                                }
                            });
                            break;

                        case "DELETE":
                            return Book.findById(stateChange.entityId, function (error, book) {
                                if (!book) {
                                    console.log("Replaying DELETE [" + index + "]: Book {_id:" + stateChange.entityId + "} does not exist!");
                                    if (index < stateChanges.length - 1) {
                                        return replay(stateChanges, ++index);
                                    } else {
                                        console.log("Replaying books DONE!");
                                        return response.send("Replaying books DONE!" + ++index + " book state changes imposed");
                                    }
                                } else {
                                    return book.remove(function (error) {
                                        if (error) {
                                            console.warn(error);
                                        } else {
                                            console.log("Replaying DELETE [" + index + "]: Book \"" + book.title + "\" deleted ...OK {_id:" + book._id + "}");
                                        }
                                        if (index < stateChanges.length - 1) {
                                            return replay(stateChanges, ++index);
                                        } else {
                                            console.log("Replaying books DONE!");
                                            return response.send("Replaying books DONE!" + ++index + " book state changes imposed");
                                        }
                                    });
                                }
                            });
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

// Route: Library API: Update a book
app.put("/api/books/:id", function (request, response) {
    return getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            delete request.body._id;
            var changes = request.body;
            if (_.isEmpty(changes)) {
                console.log("No changes in request ...aborting update");
                return response.send();
            }
            return createStateChange("UPDATE", Book, request.params.id, { changes: changes }).save(function (error, change) {
                if (error) {
                    return console.warn(error);
                }
                // Ordinary HTTP response to originating client
                response.send({ entityId: change.entityId });

                // Dispatching of asynchronous message to application store
                return updateBook(change.entityId, change.changes).then(function (book) {
                    // Broadcast message to all other participating clients when application store is updated
                    return io.sockets.emit("book-updated", book);
                });
                // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)
            });

        } else {
            return response.send();
        }
    });
});


// Route: Library API: Delete a book
app.delete("/api/books/:id", function (request, response) {
    return getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            return createStateChange("DELETE", Book, request.params.id).save(function (error, change) {
                if (error) {
                    return console.warn(error);
                }
                // Ordinary HTTP response to originating client
                response.send({ entityId: change.entityId });

                // Dispatching of asynchronous message to application store
                return removeBook(change.entityId).then(function (entityId) {
                    // Broadcast message to all other participating clients when application store is updated
                    return io.sockets.emit("book-removed", entityId);
                })
                // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)
            });

        } else {
            return response.send();
        }
    });
});
