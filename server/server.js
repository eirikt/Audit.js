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
    randomBooks = require("./script/random-books.js"),
    sequenceNumber = require("./script/mongoose.sequence-number.js");


// Mongoose schemas
var StateChangeMongooseSchema = new mongoose.Schema({
    user: String,
    timestamp: Date,
    //timestamp: { type: Date, default: Date.now }, // Possible, yes, but less maintainable code
    method: String,
    type: String,
    entityId: String,
    changes: {}
});
// TODO: verify the effect of this ...
// Indexed 'entityId' for quick grouping
//StateChangeMongooseSchema.index({ entityId: 1 }, { unique: false });

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
var StateChange = mongoose.model("statechange", StateChangeMongooseSchema);
var Keyword = mongoose.model("keyword", KeywordMongooseSchema);
var Book = mongoose.model("book", BookMongooseSchema);
Book.collectionName = function () {
    return Book.modelName + "s".toLowerCase();
};
// /Mongoose models


// Generic Mongoose helper functions
function handleError(error, response) {
    if (error) {
        console.warn(error);
        if (response) {
            response.send(500, { error: error });
        } else {
            throw new Error(error);
        }
    }
}

function createUuid() {
    return new Uuid()._id;
}

function count(model) {
    var dfd = new promise.Deferred();
    model.count(function (error, count) {
        if (error) {
            console.warn("Error when counting collection " + model.modelName + ", " + error);
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
        .sort({ timestamp: "asc" })
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
    sequenceNumber.incrementSequenceNumber(Book.collectionName(), function (error, nextSequence) {
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
    return StateChange.find().sort({ timestamp: "asc" }).exec(function (error, stateChanges) {

        var terminateReplay = function (response, index) {
            console.log("Replaying books DONE!");
            response.send(200);
            return io.sockets.emit("events-replayed");
        };

        var replay = function (stateChanges, index) {
            var stateChange = stateChanges[index];
            if (!stateChange) {
                return null;

            } else {
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
/*var db = */
mongoose.connect("mongodb://localhost/library", function (error, db) {
//var db = mongoose.connect("mongodb://localhost:27018/library", { safe: true }, function (error, db) {
    handleError(error);
    //this.db = db;
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
    console.log("Socket.IO: server connection established ...");
});


/**
 * Flag indicating whether to use an application store in addition to the event store, CQRS style.
 * The alternative is to use the event store only, being considerately more ineffective ... but hey
 */
useCQRS = false;


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
    io.sockets.emit("cqrs", useCQRS);
});


// Routes [Special]: Admin API: replay the entire event store into the application store
app.post("/events/replay", function (request, response) {
    if (!useCQRS) {
        //throw new Error("URI '/events/replay' posted when no application store in use!");
        console.warn("URI '/events/replay' posted when no application store in use!");
        return;
    }
    replayEventStore(response);
});


// Route [Command]: Admin API: generate books randomly
app.post("/library/books/generate", function (request, response) {
    var numberOfBooksToGenerate = request.body.numberOfBooks;
    if (!numberOfBooksToGenerate) {
        return response.send([]);
    }
    io.sockets.emit("generating-books", numberOfBooksToGenerate);
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

                    // Inform initiating client
                    io.emit("book-generated", numberOfBooksGenerated, book);

                    if (numberOfBooksGenerated >= numberOfBooksToGenerate) {
                        response.send(200);

                        // Inform all clients
                        return io.sockets.emit("all-books-generated", numberOfBooksGenerated);
                    }
                    return null;

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
        //throw new Error("URI '/library/books/clean' posted when no application store in use!");
        console.warn("URI '/library/books/clean' posted when no application store in use!");
    }
    return mongoose.connection.collections[Book.collectionName()].drop(function (error) {
        handleError(error, response);
        response.send(200);
        io.sockets.emit("books-removed");
    });
});


/** Mongoose MapReduce :: Map: Group all state change events by entityId */
app.mapReduce_map_groupByEntityId = function () {
    emit(this.entityId, this);
};

/**
 * Mongoose MapReduce :: Reduce:
 * 1) Sort all object state change events by timestamp ascending (oldest first and then the newer ones)
 * 2) Check that object first state change event method is a CREATE
 * 3) Abort further processing if the last object state change event method is DELETE (return null)
 * 4) Replay all object state change events (by reducing all the diffs)
 * 5) Return the "replayed" (collapsed) object
 */
app.mapReduce_reduce_replayEvents = function (key, values) {
    var sortedStateChanges = values.sort(function (a, b) {
        return a.timestamp > b.timestamp
    });
    if (sortedStateChanges[0].method !== "CREATE") {
        throw new Error("First event for book #" + key + " is not a CREATE event, rather a " + sortedStateChanges[0].method + "\n");
    }
    if (sortedStateChanges[sortedStateChanges.length - 1].method === "DELETE") {
        return null;
    }
    var retVal = {};
    sortedStateChanges.forEach(function (stateChange) {
        for (var key in stateChange.changes) {
            retVal[key] = stateChange.changes[key];
        }
    });
    return retVal;
};

/**
 * Mongoose MapReduce :: Finalize/Post-processing:
 * If Reduce phase is bypassed due to a single object state change event,
 * return this single object state change event as the object state.
 */
app.mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects = function (key, reducedValue) {
    // TODO: move this to StateChange definition
    isStateChange = function (obj) {
        // TODO: how to include external references inside mapreduce functions ...
        return obj && obj.changes /*&& _.isObject(obj.changes)*/;
    };
    if (reducedValue) {
        return isStateChange(reducedValue) ? reducedValue.changes : reducedValue;
    }
    return null;
};


// Route [Query]: Library API: get total number of books (by creating/posting a count object/resource to the server)
app.post("/library/books/count", function (request, response) {
    var titleSearchRegexString = request.body.titleSubstring,
        authorSearchRegexString = request.body.authorSubstring,
        countAll = _.isEmpty(titleSearchRegexString) && _.isEmpty(authorSearchRegexString);

    // CQRS and no search criteria
    if (countAll && useCQRS) {
        return count(Book).then(function (count) {
            return response.send({ count: count });
        });
    }

    // Parametrized search
    var searchRegexOptions = "i",
        titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions),
        authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions);

    if (useCQRS) {
        return Book.count({
                "title": titleRegexp,
                "author": authorRegexp
            },
            function (error, count) {
                handleError(error, response);
                return response.send({ count: count });
            });
    }
    var mapReduceConfig = {
        query: { type: Book.modelName },
        map: app.mapReduce_map_groupByEntityId,
        reduce: app.mapReduce_reduce_replayEvents,
        finalize: app.mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects,
        out: { replace: "filteredBooks", inline: 1 }//,
        //verbose: true
    };
    return StateChange.mapReduce(mapReduceConfig, function (error, results) {
        if (error) {
            console.warn(error);
            if (error.message === "ns doesn't exist") {
                return response.send({ count: 0 });
            } else {
                return response.send(500, { error: error });
            }
        } else {
            // Filter results and count the remaining ...
            return results.find({
                    "value.title": titleRegexp,
                    "value.author": authorRegexp
                },
                "value.seq",
                function (error, books) {
                    handleError(error, response);
                    return response.send({ count: books.length });
                });
        }
    });
});


/**
 * [CQRS Query]: Library API: get a projection of books (by creating/posting a "projection" object/resource to the server)
 *
 * In parameters, pagination:
 * <ul>
 *     <li/><code>count</code>: Number of books for each page
 *     <li/><code>index</code>: The book index
 * </ul>
 * In parameters, filtering:
 * <ul>
 *     <li/><code>titleSubstring</code>: 'title' substring (in conjunction)
 *     <li/><code>authorSubstring</code>: 'author' substring (in conjunction)
 * </ul>
 * Out parameters:
 * <ul>
 *     <li/><code>books</code>: The book projection
 *     <li/><code>count</code>: The number of books in resulting projection
 *     <li/><code>totalCount</code>: The total (unfiltered) number of books in db collection
 * </ul>
 */
app.post("/library/books/projection", function (request, response) {
    // Pagination
    var numberOfBooksForEachPage = request.body.count, // Pagination or not ...
        indexOfFirstBook = request.body.index,

        skip = 0,
        limit = null,

    // Filtering
        titleSearchRegexString = request.body.titleSubstring,
        authorSearchRegexString = request.body.authorSubstring,

        searchRegexOptions = null,
        titleRegexp = null,
        authorRegexp = null,
        findQuery = null,
        findQuery_mapreduce = null,
        sortQuery = null,
        sortQuery_mapreduce = null;

    if (numberOfBooksForEachPage) {
        // Paginate!
        limit = parseInt(numberOfBooksForEachPage, 10);
        if (indexOfFirstBook) {
            skip = parseInt(indexOfFirstBook, 10);
        }
    }
    if (!(_.isEmpty(titleSearchRegexString) && _.isEmpty(authorSearchRegexString))) {
        // Filter!
        searchRegexOptions = "i";
        titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions);
        authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions);

        findQuery = { title: titleRegexp, author: authorRegexp };
        findQuery_mapreduce = { "value.title": titleRegexp, "value.author": authorRegexp };

        sortQuery = { seq: "asc" };
        sortQuery_mapreduce = { "values.seq": "asc" };
    }

    if (useCQRS) {
        return count(Book).then(function (totalCount) {
            return Book.count(findQuery, function (error, count) {
                return Book
                    .find(findQuery)
                    // TODO: hey, sorting does not work ...
                    //.sort("+seq")
                    //.sort(sortQuery)
                    .skip(skip)
                    .limit(limit)
                    .exec(function (error, books) {
                        return response.send({ books: books, count: count, totalCount: totalCount });
                    });
            });
        });

    } else {
        // No CQRS, rather event store scanning using mapreduce ...
        var mapReduceConfig = {
            query: { type: Book.modelName},
            map: app.mapReduce_map_groupByEntityId,
            reduce: app.mapReduce_reduce_replayEvents,
            finalize: app.mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects,
            out: { replace: "getAllBooks", inline: 1 }
        };
        return StateChange.mapReduce(mapReduceConfig, function (error, results) {
            if (error) {
                console.warn(error);
                if (error.message === "ns doesn't exist") {
                    return response.send({ books: [], count: 0, totalCount: 0 });
                } else {
                    //throw new Error(error);
                    return response.send(500, { error: error });
                }
            }
            return results
                .find(function (error, totalMapReducedResult) {
                    var totalResult = [];
                    totalMapReducedResult.forEach(function (obj, index) {
                        if (obj.value) {
                            totalResult.push(obj);
                        }
                    });

                    return results
                        .find(findQuery_mapreduce)
                        .exec(function (error, projectedResult) {

                            return results
                                .find(findQuery_mapreduce)
                                .sort(sortQuery_mapreduce)
                                .skip(skip)
                                .limit(limit)
                                .exec(function (error, paginatedResult) {
                                    var books = [];
                                    paginatedResult.forEach(function (obj, index) {
                                        if (obj.value) {
                                            obj.value._id = obj._id;
                                            books.push(obj.value)
                                        }
                                    });
                                    return response.send({ books: books, count: projectedResult.length, totalCount: totalResult.length });
                                });
                        });
                });
        });
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
                        // Broadcast message to all clients when application store is updated
                        return io.sockets.emit("book-updated", book);
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    // Broadcast message to all clients when application store is updated
                    return io.sockets.emit("book-updated", change);
                }
            });

        } else {
            return response.send(404);
        }
    });
});


// Route [Command]: Library API: delete a book
app.delete("/library/books/:id", function (request, response) {
    return getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            return createStateChange("DELETE", Book, request.params.id).save(function (error, change) {
                // Ordinary HTTP response to originating client
                response.send({ entityId: change.entityId });

                if (useCQRS) {
                    // Dispatching of asynchronous message to application store
                    return removeBook(change.entityId).then(function (entityId) {
                        // Broadcast message to all clients when application store is updated
                        return io.sockets.emit("book-removed", entityId);
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    // Broadcast message to all clients when application store is updated
                    return io.sockets.emit("book-removed", change.entityId);
                }
            });

        } else {
            return response.send(404);
        }
    });
});
