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
StateChangeMongooseSchema.index({ entityId: 1 }, { unique: false });

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
            if (error && error.message) {
                response.send(500, { error: error.message });
            } else {
                response.send(500, { error: error });
            }
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
    change.user = randomBooks.randomUser();
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


// Application-specific mapreduce functions

/** Mongoose MapReduce :: Map: Group all state change events by entityId */
function mapReduce_map_groupByEntityId() {
    emit(this.entityId, this);
}

/**
 * Mongoose MapReduce :: Reduce: Replay state change events by merging them in the right order
 * 1) Sort all object state change events by timestamp ascending (oldest first and then the newer ones)
 * 2) Check that object first state change event method is a CREATE
 * 3) Abort further processing if the last object state change event method is DELETE (return null)
 * 4) Replay all object state change events (by reducing all the diffs) (abort further processing if one of the state change events being replayed have a method other than UPDATE)
 * 5) Return the "replayed" (collapsed) object
 */
function mapReduce_reduce_replayEvents(key, values) {
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
    sortedStateChanges.forEach(function (stateChange, index) {
        if (index > 0 && stateChange.method !== "UPDATE") {
            throw new Error("Expected UPDATE event, was " + stateChange.method + "\n");
        }
        for (var key in stateChange.changes) {
            retVal[key] = stateChange.changes[key];
        }
    });
    return retVal;
}

/**
 * Mongoose MapReduce :: Finalize/Post-processing:
 * If Reduce phase is bypassed due to a single object state change event,
 * return this single object state change event as the object state.
 */
function mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects(key, reducedValue) {
    // TODO: move this to StateChange definition
    isStateChange = function (obj) {
        // TODO: how to include external references inside mapreduce functions ...
        return obj && obj.changes /*&& _.isObject(obj.changes)*/;
    };
    if (reducedValue) {
        return isStateChange(reducedValue) ? reducedValue.changes : reducedValue;
    }
    return null;
}
// /Application-specific mapreduce functions


// Application-specific functions
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

// TODO: consider replacing function logic with:
// 'app.mapReduce_map_groupByEntityId',
// 'app.mapReduce_reduce_replayEvents', and
// 'app.mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects'
// NB! Emitting push messages will probably be more difficult ...
function replayEventStore() {
    console.log("Replaying entire change log ...");
    io.sockets.emit("replaying-events");
    var mapReduceConfig = {
        query: { type: Book.modelName},
        map: mapReduce_map_groupByEntityId,
        reduce: mapReduce_reduce_replayEvents,
        finalize: mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects,
        out: { replace: "replayAllBooks", inline: 1 }
    };
    return StateChange.mapReduce(mapReduceConfig, function (error, results) {
        handleError(error);
        var index = 0;
        return count(results).then(function (count) {
            // TODO: try cursors (http://stackoverflow.com/questions/15617864/execute-callback-for-each-document-found-when-mongoose-executes-find)
            return results.find().stream()
                .on("data", function (reducedBookChangeEvents) {
                    if (_.isEmpty(reducedBookChangeEvents.value)) {
                        return console.warn("Replaying books: #" + (index += 1) + ": Book " + reducedBookChangeEvents._id + " has no changes ... ");

                    } else {
                        return Book.findById(reducedBookChangeEvents._id, function (error, book) {
                            if (book) {
                                return console.log("Replaying books: #" + (index += 1) + ": Book no " + book.seq + " \"" + book.title + "\" already present! {_id:" + book._id + "}");

                            } else {
                                //console.log("Replaying books: #" + (index + 1) + ": " + JSON.stringify(reducedBookChangeEvents));
                                //console.log("Replaying books: #" + (index + 1) + ": Book no " + reducedBookChangeEvents.value.seq + " \"" + reducedBookChangeEvents.value.title + "\" {_id:" + reducedBookChangeEvents._id + "}");
                                var bookAttr = {};
                                bookAttr.entityId = reducedBookChangeEvents._id;
                                bookAttr.changes = reducedBookChangeEvents.value;
                                return _createAndSaveBook(new promise.Deferred, bookAttr).then(function () {
                                    io.sockets.emit("event-replayed", index += 1);
                                    if (index >= count) {
                                        io.sockets.emit("all-events-replayed", count);
                                    }
                                });
                            }
                        });
                    }
                })
                .on("close", function () {
                    //console.log("close!");
                })
                .on("error", function (error) {
                    handleError(error);
                });
        });
    });
}
// /Application-specific functions


// Connect to database
mongoose.connect("mongodb://localhost/library", function (error, db) {
//var db = mongoose.connect("mongodb://localhost:27018/library", { safe: true }, function (error, db) {
    handleError(error);
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
 * The "CQRS usage" flag.
 * This flag indicates whether to use an <em>application store</em> in addition to the <em>event store</em>, CQRS style.
 * The alternative is to use the event store only, being considerately more ineffective ... but as a demo
 * <em>No application store is the default (at the moment).<em>
 */
useCQRS = true;


// TODO: consider some proper REST API documentation framework
// TODO: consider counting the READs as well as these ...
/**
 * Admin API :: Get total number of state changes in event store
 *
 * CQRS Query / Event store query
 *
 * HTTP method             : GET
 * URI                     : /events/count
 * Resource in properties  : -
 * Status codes            : 200 OK
 * Resource out properties :
 *     createCount : The number of CREATE state change events (HTTP POSTs)
 *     updateCount : The number of UPDATE state change events (HTTP PUTs)
 *     deleteCount : The number of DELETE state change events (HTTP DELETEs)
 *     totalCount  : The total number of state change events in event store
 * Push messages           : -
 */
app.get("/events/count", function (request, response) {
    return StateChange.count({ method: "CREATE"}, function (error, createCount) {
        return StateChange.count({ method: "UPDATE"}, function (error, updateCount) {
            return StateChange.count({ method: "DELETE"}, function (error, deleteCount) {
                return response.send(200, {
                    createCount: createCount,
                    updateCount: updateCount,
                    deleteCount: deleteCount,
                    totalCount: createCount + updateCount + deleteCount
                });
            })
        })
    })
});


/**
 * Admin API :: Get all state changes for a particular entity
 *
 * CQRS Query / Event store query
 *
 * HTTP method            : GET
 * URI                    : /events/:entityId
 * Resource in properties : -
 * Status codes           : 200 OK
 * Resource out           : Array of 'StateChangeMongooseSchema'-based objects/resources
 * Push messages          : -
 */
app.get("/events/:entityId", function (request, response) {
    return getStateChangesByEntityId(request.params.entityId).then(function (stateChanges) {
        return response.send(200, stateChanges);
    });
});


/**
 * Admin API :: Get the "CQRS usage" flag (in-memory)
 *
 * CQRS Query
 *
 * HTTP method             : GET
 * URI                     : /events/cqrs/status
 * Resource in properties  : -
 * Status codes            : 200 OK
 * Resource out properties : Boolean value indicating whether CQRS is activated on the server or not
 * Push messages           : -
 */
app.get("/events/cqrs/status", function (request, response) {
    response.send(200, useCQRS);
});


/**
 * Admin API :: Switch the "CQRS usage" (in-memory) flag
 * (by creating and sending (posting) a "toggle" object/resource to the server)
 *
 * CQRS Query
 *
 * HTTP method             : POST
 * URI                     : /events/cqrs/toggle
 * Resource in properties  : -
 * Status codes            : 202 Accepted
 * Resource out properties : -
 * Push messages           :
 *     cqrs                { the new CQRS usage flag value }
 *     replaying-events    { }
 *     event-replayed      { the index of the replayed state change event }
 *     all-events-replayed { the total number of replayed state change events }
 */
app.post("/events/cqrs/toggle", function (request, response) {
    response.send(202);
    if (useCQRS) {
        console.log("Bypassing application store - will use event store only!");
    } else {
        console.log("Activating application store ...");
    }
    useCQRS = !useCQRS;
    io.sockets.emit("cqrs", useCQRS);
    if (useCQRS) {
        replayEventStore();
    }
});


/**
 * Admin API :: Replay the entire <em>event store</em> into the <em>application store</em>
 * (by creating and sending (posting) a "replay" object/resource to the server)
 *
 * CQRS Query / Application store special
 *
 * HTTP method             : POST
 * URI                     : /events/replay
 * Resource in properties  : -
 * Status codes            :
 *     202 Accepted
 *     403 Forbidden : No application store is in use
 * Resource out properties : -
 * Push messages           :
 *     cqrs                { the new CQRS usage flag value }
 *     replaying-events    { }
 *     event-replayed      { the index of the replayed state change event }
 *     all-events-replayed { the total number of replayed state change events }
 */
app.post("/events/replay", function (request, response) {
    "use strict";
    if (!useCQRS) {
        var msg = "URI '/events/replay' posted when no application store in use!";
        console.warn(msg);
        return response.send(403, msg);
    }
    response.send(202);
    return replayEventStore();
});


/**
 * Admin API :: Generate books randomly
 * (by creating and sending (posting) a "generate" object/resource to the server)
 *
 * CQRS Command
 *
 * HTTP method             : POST
 * URI                     : /library/books/generate
 * Resource in properties  :
 *     numberOfBooks : number of books to generate, mandatory
 * Status codes            :
 *     202 Accepted
 *     422 Unprocessable Entity : Missing mandatory property "numberOfBooks"
 * Resource out properties : -
 * Push messages           :
 *     generating-books    { }
 *     book-generated      { the index of the generated book, the book resource }
 *     all-books-generated { the total number of books generated }
 */
app.post("/library/books/generate", function (request, response) {
    var numberOfBooksToGenerate = request.body.numberOfBooks,
        i,
        numberOfBooksGenerated = 0,
        existingNumberOfBooksAtStart;

    if (!numberOfBooksToGenerate) {
        return response.send(422, "Property 'numberOfBooks' is mandatory");
    }
    response.send(202);
    io.sockets.emit("generating-books", numberOfBooksToGenerate);
    return count(Book).then(
        function (bookCountAtStart) {
            existingNumberOfBooksAtStart = bookCountAtStart;
            for (i = 0; i < parseInt(numberOfBooksToGenerate, 10); i += 1) {
                createBook({
                    title: randomBooks.randomBookTitle(),
                    author: randomBooks.randomName(),
                    keywords: [
                        createKeyword(randomBooks.pickRandomElementFrom(randomBooks.keywords)),
                        createKeyword(randomBooks.pickRandomElementFrom(randomBooks.keywords))
                    ]
                }).then(
                    function (book) {
                        numberOfBooksGenerated += 1;
                        io.sockets.emit("book-generated", numberOfBooksGenerated, book);
                        if (numberOfBooksGenerated >= numberOfBooksToGenerate) {
                            io.sockets.emit("all-books-generated", numberOfBooksGenerated);
                        }

                    }, function (error) {
                        return handleError(error, response);
                    }
                );
            }
        });
});


/**
 * Admin API :: Purge the entire application store
 * (by creating and sending (posting) a "clean" object/resource to the server)
 *
 * CQRS Query / Application store special
 *
 * HTTP method             : POST
 * URI                     : /library/books/clean
 * Resource in properties  : -
 * Status codes            :
 *     202 Accepted      : When no application store is in use
 *     205 Reset Content : When application store is is use
 * Resource out properties : -
 * Push messages           : books-removed { }
 */
app.post("/library/books/clean", function (request, response) {
    if (!useCQRS) {
        console.warn("URI '/library/books/clean' posted when no application store in use!");
        response.send(202);
    } else {
        response.send(205);
    }
    return mongoose.connection.collections[Book.collectionName()].drop(function (error) {
        handleError(error, response);
        io.sockets.emit("books-removed");
    });
});


/**
 * Library API :: Get total number of books (by creating/posting a count object/resource to the server)
 * (by creating and sending (posting) a "count" object/resource to the server)
 *
 * CQRS Query
 *
 * HTTP method             : POST
 * URI                     : /library/books/count
 * Resource in properties  :
 *     titleSubstring  : Optional, book.title filtering (in conjunction with other filtering properties)
 *     authorSubstring : Optional, book.author filtering (in conjunction with other filtering properties)
 * Status codes            : 200 OK
 * Resource out properties :
 *     count:
 * Push messages           : -
 */
app.post("/library/books/count", function (request, response) {
    var titleSearchRegexString = request.body.titleSubstring,
        authorSearchRegexString = request.body.authorSubstring,
        countAll = _.isEmpty(titleSearchRegexString) && _.isEmpty(authorSearchRegexString);

    // CQRS and no search criteria
    if (countAll && useCQRS) {
        return count(Book).then(function (count) {
            return response.send(200, { count: count });
        });
    }

    // Filtered/projection count
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
                return response.send(200, { count: count });
            });
    }
    var mapReduceConfig = {
        query: { type: Book.modelName },
        map: mapReduce_map_groupByEntityId,
        reduce: mapReduce_reduce_replayEvents,
        finalize: mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects,
        out: { replace: "filteredBooks", inline: 1 }
    };
    return StateChange.mapReduce(mapReduceConfig, function (error, results) {
        if (error) {
            console.warn(error);
            if (error.message === "ns doesn't exist") {
                return response.send(200, { count: 0 });
            } else {
                return response.send(500, { error: error.message });
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
                    return response.send(200, { count: books.length });
                });
        }
    });
});


/**
 * Library API :: Get a projection of books
 * (by creating and sending (posting) a "projection" object/resource to the server)
 *
 * CQRS Query
 *
 * HTTP method             : POST
 * URI                     : /library/books/projection
 * Resource in properties  :
 *     count           : Optional, the number of books for each page (also flag for paginated projection or not)
 *     index           : Optional, the starting book index if paginated projection
 *     titleSubstring  : Optional, book.title filtering (in conjunction with other filtering properties)
 *     authorSubstring : Optional, book.author filtering (in conjunction with other filtering properties)
 * Status codes            : 200 OK
 * Resource out properties :
 *     books      : The book projection (array of "BookMongooseSchema" object resources)
 *     count      : The number of books in resulting projection
 *     totalCount : The total (unfiltered) number of books in db collection
 * Push messages           : -
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
        findQuery_mapreduce = null;

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
    }

    if (useCQRS) {
        return count(Book).then(function (totalCount) {
            return Book.count(findQuery, function (error, count) {
                return Book
                    .find(findQuery)
                    .sort({ seq: "asc" })
                    .skip(skip)
                    .limit(limit)
                    .exec(function (error, books) {
                        return response.send(200, { books: books, count: count, totalCount: totalCount });
                    });
            });
        });

    } else {
        // No CQRS, rather event store scanning using mapreduce ...
        var mapReduceConfig = {
            query: { type: Book.modelName},
            map: mapReduce_map_groupByEntityId,
            reduce: mapReduce_reduce_replayEvents,
            finalize: mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects,
            out: { replace: "getAllBooks", inline: 1 }
        };
        return StateChange.mapReduce(mapReduceConfig, function (error, results) {
            if (error) {
                if (error.message === "ns doesn't exist") {
                    return response.send(200, { books: [], count: 0, totalCount: 0 });
                } else {
                    return handleError(error, response);
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
                                .sort({ "value.seq": "asc" })
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
                                    return response.send(200, { books: books, count: projectedResult.length, totalCount: totalResult.length });
                                });
                        });
                });
        });
    }
});


/**
 * Library API :: Update a book
 *
 * CQRS Command
 *
 * HTTP method             : PUT
 * URI                     : /library/books/{id}
 * Resource in properties  : (a "BookMongooseSchema" object resource)
 * Status codes            :
 *     201 Created              : a new update event is stored
 *     404 Not Found            : when the resource does not exist
 *     422 Unprocessable Entity : when request body is empty
 * Resource out properties :
 *     entityId : The entity id of the updated book
 * Push messages           : book-updated { change: the "BookMongooseSchema" object changes }
 */
app.put("/library/books/:id", function (request, response) {
    return getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            delete request.body._id;
            var changes = request.body;
            if (_.isEmpty(changes)) {
                console.log("No changes in request ...aborting update");
                return response.send(422, "No changes in update request");
            }
            return createStateChange("UPDATE", Book, request.params.id, { changes: changes }).save(function (error, change) {
                handleError(error, response);
                response.send(201, { entityId: change.entityId });
                if (useCQRS) {
                    // Dispatching of asynchronous message to application store
                    return updateBook(change.entityId, change.changes).then(function (book) {
                        // Broadcast message to all clients when application store is updated
                        return io.sockets.emit("book-updated", { change: change.changes });
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    // Broadcast message to all clients when application store is updated
                    return io.sockets.emit("book-updated", { change: change.changes });
                }
            });

        } else {
            return response.send(404);
        }
    });
});


/**
 * Library API :: Delete a book
 *
 * CQRS Command
 *
 * HTTP method             : DELETE
 * URI                     : /library/books/{id}
 * Resource in properties  : -
 * Status codes            :
 *     201 Created              : a new update event is stored
 *     404 Not Found            : when the resource does not exist / already deleted
 * Resource out properties :
 *     entityId : The entity id of the updated book
 * Push messages           : book-removed { entityId: The entity id of the updated book }
 */
app.delete("/library/books/:id", function (request, response) {
    return getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            return createStateChange("DELETE", Book, request.params.id).save(function (error, change) {
                handleError(error, response);
                response.send(200, { entityId: change.entityId });
                if (useCQRS) {
                    return removeBook(change.entityId).then(function (entityId) {
                        return io.sockets.emit("book-removed", { entityId: entityId });
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    return io.sockets.emit("book-removed", { entityId: change.entityId });
                }
            });

        } else {
            return response.send(404);
        }
    });
});
