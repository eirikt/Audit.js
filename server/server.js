/* Target API:

 // [CQRS Query/Event store Query]: Admin API: Get total number of state changes(by creating/posting a "count" object/resource to the server)
 POST /events/count

 // [CQRS Query/Event store Query]: Admin API: Get all state changes for a particular entity
 GET /events/:entityId

 // [CQRS Query/Application store Special]: Admin API: replay the entire event store into the application store (by creating/posting a "replay" object/resource to the server)
 POST /events/replay

 // [Special]: Admin API: purge the entire application store (by creating/posting a "clean" object/resource to the server)
 POST /library/books/clean

 // [CQRS Command]: Admin API: generate books randomly (by creating/posting a "generate" object/resource to the server)
 POST /library/books/generate

 ...

 // [CQRS Query]: Library API: get total number of books (by creating/posting a "count" object/resource to the server)
 POST /library/books/count

 // [CQRS Query]: Library API: get a projection of books (by creating/posting a "projection" object/resource to the server)
 POST /library/books/projection

 TODO: ??
 // [CQRS Command]: Library API: add a new book (by creating/posting a "newbook" object/resource to the server)
 POST /library/books/newbook/ ??

 // [CQRS Command]: Library API: update a book
 PUT /library/books/:id

 // [CQRS Command]: Library API: delete a book
 DELETE /library/books/:id
 */


// Module dependencies, external
var application_root = __dirname,
    _ = require("underscore"),
    promise = require("promised-io/promise"),
    path = require("path"),
    socketio = require("socket.io"),
    http = require("http"),
    express = require("express"),
    mongoose = require("mongoose"),

// Module dependencies, internal
    randomBooks = require("./script/random-book-data.js");


// Mongoose schemas
var SequenceNumberMongooseSchema = new mongoose.Schema({
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
// /Mongoose schemas


// Mongoose models (design rule: lower-case collection names)
var Uuid = mongoose.model("uuid", mongoose.Schema({}));
var Sequence = mongoose.model("sequence", SequenceNumberMongooseSchema);
var StateChange = mongoose.model("statechange", StateChangeMongooseSchema);
StateChange.isStateChange = function (obj) {
    //if (obj && obj.)
    return true;
};
var Keyword = mongoose.model("keyword", KeywordMongooseSchema);
var Book = mongoose.model("book", BookMongooseSchema);
Book.collectionName = function () {
    return Book.modelName + "s".toLowerCase();
};
// /Mongoose models


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


// Generic state versioning functions
function createStateChange(method, model, entityId, options) {
    // Create state change event
    var change = new StateChange();

    // Create state change event: Meta data
    change.user = randomBooks.pickRandomElementFrom(randomBooks.users);
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
        if (useCQRS) {
            return createAndSaveApplicationObjectFunction(deferred, change);
        } else {
            return deferred.resolve(changes);
        }
    });
    return deferred.promise;
}

function getStateChangesByEntityId(entityId) {
    var dfd = new promise.Deferred();
    StateChange
        .find({ entityId: entityId })
        .sort({ timestamp: "asc"})
        .exec(function (error, stateChanges) {
            if (error) {
                return dfd.reject(error);
            }
            return dfd.resolve(stateChanges);
        });
    return dfd.promise;
}
// /Generic state versioning functions


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
        // TODO: Consider promise instead of '_createAndSaveBook' callback here
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

function replayEventStore(response) {
    console.log("Replaying entire change log ...");
    return StateChange.find().sort({ timestamp: "asc"}).find(function (error, stateChanges) {
        var terminateReplay = function (response, index) {
            console.log("Replaying books DONE!");
            io.sockets.emit("events-replayed");
            return response.send("Replaying books DONE!" + index + " book state changes replayed");
        };
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
                                        return replay(stateChanges, index += 1);
                                    } else {
                                        return terminateReplay(response, index += 1);
                                    }
                                } else {
                                    return _createAndSaveBook(new promise.Deferred, stateChange).then(function () {
                                        if (index < stateChanges.length - 1) {
                                            return replay(stateChanges, index += 1);
                                        } else {
                                            return terminateReplay(response, index += 1);
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
                                        return terminateReplay(response, index += 1);
                                    }
                                } else {
                                    return book.update(stateChange.changes, function (error, numberAffected) {
                                        if (error) {
                                            console.warn(error);
                                        } else {
                                            console.log("Replaying UPDATE [" + index + "]: Book \"" + book.title + "\" updated ...OK {_id:" + book._id + "} #changes:" + numberAffected);
                                        }
                                        if (index < stateChanges.length - 1) {
                                            return replay(stateChanges, index += 1);
                                        } else {
                                            return terminateReplay(response, index += 1);
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
                                        return replay(stateChanges, index += 1);
                                    } else {
                                        return terminateReplay(response, index += 1);
                                    }
                                } else {
                                    return book.remove(function (error) {
                                        if (error) {
                                            console.warn(error);
                                        } else {
                                            console.log("Replaying DELETE [" + index + "]: Book \"" + book.title + "\" deleted ...OK {_id:" + book._id + "}");
                                        }
                                        if (index < stateChanges.length - 1) {
                                            return replay(stateChanges, index += 1);
                                        } else {
                                            return terminateReplay(response, index += 1);
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
}
// /Application-specific helper functions


// Connect to database
var db = mongoose.connect("mongodb://localhost/library", { safe: true }, function (error, db) {
    if (error) {
        console.warn(error);
        throw new Error(error);
    }
    this.db = db;
});


app = express();

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

server = http.createServer(app);


port = 4711;

server.listen(port, function () {
    console.log("Express server listening on port %d in %s mode", port, app.settings.env);
});


io = socketio.listen(server);

io.sockets.on("connection", function (socket) {
    console.log("Socket.IO: server connection caught ...");
});


/**
 * Flag indicating whether to use an application store in addition to the event store, CQRS style.
 * The alternative is to use the event store only, being considerately more ineffective ... but hey
 */
useCQRS = true;


// Route [Event store Query]: Admin API: Get total number of state changes
app.post("/events/count", function (request, response) {
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


// Route [Event store Query]: Admin API: Get all state changes for a particular entity
app.get("/events/:entityId", function (request, response) {
    return getStateChangesByEntityId(request.params.entityId).then(function (stateChanges) {
        return response.send(stateChanges);
    });
});


// TODO: ...
app.get("/events/cqrs/status", function (request, response) {
    response.send(useCQRS);
});


// TODO: ...
app.post("/events/cqrs/toggle", function (request, response) {
    if (useCQRS) {
        console.log("Bypassing application store - will use event store only!");
    } else {
        console.log("Activating application store ...");
    }
    useCQRS = !useCQRS;

    response.send(useCQRS);

    if (useCQRS) {
        replayEventStore(response);
    }
});


// Routes [Special]: Admin API: replay the entire event store into the application store
app.post("/events/replay", function (request, response) {
    if (!useCQRS) {
        throw new Error("URI '/events/replay' posted when no application store in use!");
    }
    replayEventStore(response);
});


// Route [Command]: Admin API: generate books randomly
app.post("/library/books/generate", function (request, response) {
    var numberOfBooksToGenerate = request.body.numberOfBooks;
    if (!numberOfBooksToGenerate) {
        return response.send([]);
    }
    io.sockets.emit("adding-books", numberOfBooksToGenerate);
    var i, numberOfBooksGenerated = 0, numberOfBooksAtStart;
    return count(Book).then(function (bookCountAtStart) {
        numberOfBooksAtStart = bookCountAtStart;
        for (i = 0; i < parseInt(numberOfBooksToGenerate, 10); i += 1) {
            createBook({
                title: randomBooks.pickRandomElementFrom(randomBooks.titleElement1) + " " + randomBooks.pickRandomElementFrom(randomBooks.titleElement2) + " " + randomBooks.pickRandomElementFrom(randomBooks.titleElement3),
                author: randomBooks.pickRandomElementFrom(randomBooks.firstNames) + " " + randomBooks.pickRandomElementFrom(randomBooks.lastNames),
                keywords: [createKeyword(randomBooks.pickRandomElementFrom(randomBooks.keywords)), createKeyword(randomBooks.pickRandomElementFrom(randomBooks.keywords))]
            }).then(function (book) {
                    numberOfBooksGenerated += 1;

                    // Inform all clients
                    io.sockets.emit("book-added", numberOfBooksGenerated, book);

                    if (numberOfBooksGenerated >= numberOfBooksToGenerate) {
                        //    return count(Book).then(function (currentBookCount) {
                        //        return StateChange.count({ method: "CREATE"}, function (error, createCount) {
                        //            return StateChange.count({ method: "UPDATE"}, function (error, updateCount) {
                        //                return StateChange.count({ method: "DELETE"}, function (error, deleteCount) {
                        //                    var responseObj = {
                        //                        book: book,
                        //                        bookCount: currentBookCount,
                        //                       stateChangeCreateCount: createCount,
                        //                        stateChangeUpdateCount: updateCount,
                        //                        stateChangeDeleteCount: deleteCount,
                        //                        stateChangeCount: createCount + updateCount + deleteCount
                        //                    };
                        io.sockets.emit("books-added", numberOfBooksToGenerate);
                        return response.send();
                        //                })
                        //            })
                        //        })
                        //    });
                    }
                }, function (error) {
                    return response.send({
                        error: error.message
                    });
                }
            );
        }
    });
});


// Routes [Special]: Admin API: purge the entire application store
app.post("/library/books/clean", function (request, response) {
    if (!useCQRS) {
        throw new Error("URI '/library/books/clean' posted when no application store in use!");
    }
    return mongoose.connection.collections[Book.collectionName()].drop(function (error) {
        if (error) {
            console.warn(error);
            return response.send({ error: error });
        }
        io.sockets.emit("books-removed");
        return response.send("Book collection dropped!");
    });
});


/** Mongo DB MapReduce :: Map: Group all state change events by entityId */
app.groupBy_entityId = function () {
    //print("emit (" + this.entityId + ", " + JSON.stringify(this));
    emit(this.entityId, this);
    /*
     emit(this.entityId, {
     "timestamp": this.changes.timestamp,
     "title": this.changes.title,
     "author": this.changes.author
     });
     */
};

/** ... */
app.reduce = function (key, values) {
    //print("#1 reduce (k: " + key + ", values: " + JSON.stringify(values));

    var sortedStateChanges = values.sort(function (a, b) {
        return a.timestamp > b.timestamp
    });
    //print("#2 reduce (sortedStateChanges) " + JSON.stringify(sortedStateChanges));

    if (sortedStateChanges[0].method !== "CREATE") {
        throw new Error("First event for book #" + key + " is not a CREATE event, rather a " + sortedStateChanges[0].method + "\n");
    }

    if (sortedStateChanges[sortedStateChanges.length - 1].method === "DELETE") {
        return null;
    }

    var retVal = {};//sortedStateChanges[0].changes;
    sortedStateChanges.forEach(function (stateChange) {
        //print("#3-1 reduce (retVal) " + JSON.stringify(retVal));
        //print("#3-2 reduce (stateChange)    " + JSON.stringify(stateChange));
        //print("#3-3 reduce (stateChange.changes)    " + JSON.stringify(stateChange.changes));
        for (var key in stateChange.changes) {
            //print("#3-3-1 reduce (key)       " + JSON.stringify(key));
            //print("#3-3-2 reduce (retVal[key])       " + JSON.stringify(retVal[key]));
            //print("#3-3-3 reduce (stateChange.changes[key])       " + JSON.stringify(stateChange.changes[key]));

            retVal[key] = stateChange.changes[key];
        }
        //print("#3-4 reduce (retVal) " + JSON.stringify(retVal));
    });
    //print("#4 reduce (return)" + JSON.stringify(retVal));

    return retVal;
};

/** ... */
app.finalize = function (key, reducedValue) {
    //print("finalize (" + JSON.stringify(key) + ", " + JSON.stringify(reducedValue) + ") ...");
    var retVal = null;
    if (reducedValue) {
        //if (StateChange.isStateChange(reducedValue)) {
        if (reducedValue.changes) {
            retVal = reducedValue.changes;
        } else {
            retVal = reducedValue;
        }
    }
    //print("finalize retVal: " + JSON.stringify(retVal));
    return retVal;
};

// Route [Query]: Library API: get total number of books (by creating/posting a count object/resource to the server)
app.post("/library/books/count", function (request, response) {
        var titleSearchRegexString = request.body.titleSubstring,
            authorSearchRegexString = request.body.authorSubstring,
            countAll = _.isEmpty(titleSearchRegexString) && _.isEmpty(authorSearchRegexString);

        // Full search / no search criteria and CQRS
        if (countAll && useCQRS) {
            return count(Book).then(function (count) {
                return response.send({ count: count });
            });
        }

        /*
         return StateChange.aggregate({
         $group: {
         _id: "$entityId", count: { $sum: 1 }
         }
         }, function (error, count) {
         return response.send({ count: count.length });
         }
         );
         }
         }
         */

        // Parametrized search
        var searchRegexOptions = "i",
            titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions),
            authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions);

        if (useCQRS) {
            return Book.find({
                    "title": titleRegexp,
                    "author": authorRegexp
                },
                function (error, books) {
                    return response.send({ count: books.length });
                });

        } else {
            var mapReduceConfig = {
                query: { type: Book.modelName},
                map: app.groupBy_entityId,
                reduce: app.reduce,
                finalize: app.finalize,
                out: { replace: "filteredBooks", inline: 1 },
                verbose: true
            };
            StateChange.mapReduce(mapReduceConfig, function (error, results) {
                //console.log("MAPREDUCE RESULTS:");
                //console.log(results);
                results.find(function (error, books) {
                    console.log("MAPREDUCE BOOKS:");
                    console.log(books);
                });

                /*
                 var finalResult = [];
                 results.forEach(function (obj, index) {
                 if (obj.value) {
                 finalResult.push(obj.value)
                 }
                 });
                 */

                // Filter results and count the remaining ...
                return results.find({
                        "value.title": titleRegexp,
                        "value.author": authorRegexp
                    },
                    "value.seq",
                    function (error, books) {
                        //console.log("MAPREDUCE RESULTS.FIND():");
                        //console.log(books);
                        return response.send({ count: books.length });
                    });
            });
        }
    }
);


// Route [Query]: Library API: get all books (with search criteria in query string)
// TODO: I would really like a POST here
app.get("/library/books", function (request, response) {
    var numberOfBooksForEachPage = request.query.count; // Pagination or not ...
    if (useCQRS) {
        if (!numberOfBooksForEachPage) {
            throw new Error("Is this code in use?");
            //return Book.find().sort({ seq: "asc" }).exec(function (error, books) {
            //    return response.send({ books: books });
            //});

        } else {
            //var orderBy = request.query.orderBy; // Not yet supported
            var firstBook = request.query.index;
            return count(Book).then(function (count) {
                return Book.find().sort({ seq: "asc" }).skip(firstBook).limit(numberOfBooksForEachPage).exec(function (error, books) {
                    return response.send({ books: books, count: count });
                });
            });
        }

    } else {

        if (!numberOfBooksForEachPage) {
            throw new Error("Is this code in use?");

        } else {
            var mapReduceConfig = {
                query: { type: Book.modelName},
                map: app.groupBy_entityId,
                reduce: app.reduce,
                finalize: app.finalize,
                out: { replace: "getAllBooks", inline: 1 },
                verbose: true
            };
            StateChange.mapReduce(mapReduceConfig, function (error, results) {
                var firstBook = request.query.index;

                return results.find(function (error, totalResult) {
                    return results.find().sort({ "values.seq": "asc" }).skip(firstBook).limit(numberOfBooksForEachPage).exec(function (error, paginatedResult) {
                        var books = [];
                        paginatedResult.forEach(function (obj, index) {
                            if (obj.value) {
                                obj.value._id = obj._id;
                                books.push(obj.value)
                            }
                        });
                        return response.send({ books: books, count: totalResult.length });
                    });
                });
            });
        }
    }
});


// Route [Command]: Library API: update a book
app.put("/library/books/:id", function (request, response) {
    return getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            delete request.body._id;
            var changes = request.body;
            if (_.isEmpty(changes)) {
                console.log("No changes in request ...aborting update");
                return response.send();
            }
            return createStateChange("UPDATE", Book, request.params.id, { changes: changes }).save(function (error, change) {
                // Ordinary HTTP response to originating client
                response.send({ entityId: change.entityId });

                if (useCQRS) {
                    // Dispatching of asynchronous message to application store
                    return updateBook(change.entityId, change.changes).then(function (book) {
                        // Broadcast message to all other participating clients when application store is updated
                        return io.sockets.emit("book-updated", book);
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    // Broadcast message to all other participating clients when application store is updated
                    return io.sockets.emit("book-updated", change);
                }
            });

        } else {
            return response.send();
        }
    });
});


// Route [Command]: Library API: delete a book
app.delete("/library/books/:id", function (request, response) {
    return getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            return createStateChange("DELETE", Book, request.params.id).save(function (error, change) {
                if (error) {
                    return console.warn(error);
                }
                // Ordinary HTTP response to originating client
                response.send({ entityId: change.entityId });

                if (useCQRS) {
                    // Dispatching of asynchronous message to application store
                    return removeBook(change.entityId).then(function (entityId) {
                        // Broadcast message to all other participating clients when application store is updated
                        return io.sockets.emit("book-removed", entityId);
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    // Broadcast message to all other participating clients when application store is updated
                    return io.sockets.emit("book-removed", change.entityId);
                }
            });

        } else {
            return response.send();
        }
    });
});
