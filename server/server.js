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
    error = require("./script/error.js"),
    sequenceNumber = require("./script/mongoose.sequence-number.js"),
    eventSourcing = require("./script/mongoose.event-sourcing.js"),
    randomBooks = require("./script/random-books.js");


// Mongoose schemas
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
var Keyword = mongoose.model("keyword", KeywordMongooseSchema);
var Book = mongoose.model("book", BookMongooseSchema);
Book.collectionName = function () {
    return Book.modelName + "s".toLowerCase();
};
// /Mongoose models


// Generic Mongoose functions
function count(model) {
    var dfd = new promise.Deferred();
    model.count(function (err, count) {
        if (err) {
            return error.handle(
                { message: "Error when counting collection " + model.modelName + " (" + err.message + ")" },
                { deferred: dfd });
        }
        return dfd.resolve(count)
    });
    return dfd.promise;
}
// /Generic Mongoose functions


// Application-specific functions
function createKeyword(keyword) {
    return new Keyword({ keyword: keyword });
}


/** 'Build' means build Book object from StateChange object ...  */
function buildAndSaveBook(deferred, bookStateChangeObject) {
    var book = new Book({ _id: bookStateChangeObject.entityId });
    book.set(bookStateChangeObject.changes);
    book.save(function (err, book) {
        if (error.handle(err, { deferred: deferred })) {
            return null;
        }
        console.log("Book #" + book.seq + " '" + book.title + "' saved ...OK (ID=" + book._id + ")");
        return deferred.resolve();
    });
    return deferred.promise;
}


function createBook(bookAttributes, options) {
    var dfd = new promise.Deferred();
    sequenceNumber.incrementSequenceNumber(Book.collectionName(), function (err, nextSequence) {
        if (error.handle(err, { deferred: dfd })) {
            return null;
        }
        if (options) {
            io.sockets.emit("sequencenumber-acquired", options.sessionIndex, options.sessionTotal);
            if (options.sessionIndex >= options.sessionTotal) {
                io.sockets.emit("all-sequencenumbers-acquired", options.sessionIndex);
            }
        }
        bookAttributes.seq = nextSequence;
        return eventSourcing.stateChange("CREATE", Book, null, bookAttributes, randomBooks.randomUser())
            .then(
            function (stateChange) {
                if (options) {
                    io.sockets.emit("statechangeevent-created", options.sessionIndex, options.sessionTotal);
                    if (options.sessionIndex >= options.sessionTotal) {
                        io.sockets.emit("all-statechangeevents-created", options.sessionIndex);
                    }
                }
                if (useCQRS) {
                    return buildAndSaveBook(dfd, stateChange);
                } else {
                    return dfd.resolve();
                }
            }
        );
    });
    return dfd.promise;
}


function updateBook(id, changes) {
    var dfd = new promise.Deferred();
    Book.findByIdAndUpdate(id, changes, function (err, book) {
        if (error.handle(err, { deferred: dfd })) {
            return null;
        }
        console.log("Book '" + book.title + "' [id=" + book._id + "] updated ...OK");
        return dfd.resolve(book);
    });
    return dfd.promise;
}


function removeBook(id) {
    var dfd = new promise.Deferred();
    Book.findByIdAndRemove(id, function (err) {
        if (error.handle(err, { deferred: dfd })) {
            return null;
        }
        console.log("Book [id=" + id + "] deleted ...OK");
        dfd.resolve(id);
    });
    return dfd.promise;
}


function replayEventStore() {
    console.log("Replaying entire change log ...");
    // TODO: factor out and move to 'mongoose.event-sourcing.js''
    var mapReduceConfig = {
        query: { type: Book.modelName},
        map: eventSourcing.mapReduce_map_groupByEntityId,
        reduce: eventSourcing.mapReduce_reduce_replayStateChangeEvents,
        finalize: eventSourcing.mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects,
        out: {
            replace: "replayingOfAllBooks",
            inline: 1//,
            //scope: {
            //    _replayStateChanges: _replayStateChanges
            //}
        }
    };
    return eventSourcing.StateChange.mapReduce(mapReduceConfig, function (err, results) {
        if (err) {
            if (err.message === "ns doesn't exist") {
                console.warn(err);
                return null;
            } else {
                return error.handle(err);
            }
        }
        //io.sockets.emit("replaying-events");
        var index = 0;
        return count(results).then(function (count) {
            io.sockets.emit("replaying-events", count);
            // TODO: try cursors instead of stream (http://stackoverflow.com/questions/15617864/execute-callback-for-each-document-found-when-mongoose-executes-find)
            return results.find().stream()
                .on("data", function (reducedBookChangeEvents) {
                    if (_.isEmpty(reducedBookChangeEvents.value)) {
                        index += 1;
                        return console.log("Replaying books: #" + (index) + ": Book " + reducedBookChangeEvents._id + " has no changes ... probably DELETED");

                    } else {
                        return Book.findById(reducedBookChangeEvents._id, function (err, book) {
                            index += 1;
                            if (book) {
                                //io.sockets.emit("event-replayed", index += 1, count);
                                io.sockets.emit("event-replayed");
                                if (index >= count) {
                                    io.sockets.emit("all-events-replayed", index);
                                }
                                return console.log("Replaying books: #" + index + ": Book no " + book.seq + " \"" + book.title + "\" already present! {_id:" + book._id + "}");

                            } else {
                                // Create emulated state change object and recreate book out of it
                                var bookAttr = {};
                                bookAttr.entityId = reducedBookChangeEvents._id;
                                bookAttr.changes = reducedBookChangeEvents.value;
                                return buildAndSaveBook(new promise.Deferred, bookAttr).then(function () {
                                    io.sockets.emit("event-replayed", index, count);
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
                .on("error", function (err) {
                    error.handle(err);
                });
        });
    });
}
// /Application-specific functions


// Connect to database
mongoose.connect("mongodb://localhost/library", function (err, db) {
//var db = mongoose.connect("mongodb://localhost:27018/library", { safe: true }, function (err, db) {
    error.handle(err);
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
useCQRS = false;


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
    return eventSourcing.StateChange.count({ method: "CREATE"}, function (err, createCount) {
        return eventSourcing.StateChange.count({ method: "UPDATE"}, function (err, updateCount) {
            return eventSourcing.StateChange.count({ method: "DELETE"}, function (err, deleteCount) {
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
    return eventSourcing.getStateChangesByEntityId(request.params.entityId).then(function (stateChanges) {
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
 *     event-replayed      { the index of the replayed state change event, the total number of state change events expected to be replayed }
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
 *     acquiring-sequencenumbers    { the total number sequence numbers to be acquired }
 *     acquiring-sequencenumbers    { the index of the generated sequence number, the total number sequence numbers to be acquired }
 *     all-sequencenumbers-acquired { the total number sequence numbers acquired }
 *
 *     creating-statechangeevents    { the total number state change events to be created }
 *     statechangeevent-created      { the index of the created state change event, the total number state change events to be created }
 *     all-statechangeevents-created { the total number state change events created }
 *
 *     generating-books    { the total number of books to be generated }
 *     book-generated      { the index of the generated book, the total number of books to be generated }
 *     all-books-generated { the total number of books generated }
 */
app.post("/library/books/generate", function (request, response) {
    var numberOfBooksToGenerate = request.body.numberOfBooks,
        i,
        numberOfBooksGenerated = 0;

    if (!numberOfBooksToGenerate) {
        response.send(422, "Property 'numberOfBooks' is mandatory");

    } else {
        response.send(202);
        io.sockets.emit("acquiring-sequencenumbers", numberOfBooksToGenerate);
        io.sockets.emit("creating-statechangeevents", numberOfBooksToGenerate);
        io.sockets.emit("generating-books", numberOfBooksToGenerate);
        for (i = 0; i < parseInt(numberOfBooksToGenerate, 10); i += 1) {
            createBook({
                title: randomBooks.randomBookTitle(),
                author: randomBooks.randomName(),
                // TODO: like this ... (but strange errors observed))
                //keywords: [randomBooks.randomKeyword(), randomBooks.randomKeyword()]
                keywords: [
                    createKeyword(randomBooks.pickRandomElementFrom(randomBooks.keywords)),
                    createKeyword(randomBooks.pickRandomElementFrom(randomBooks.keywords))
                ]
            }, {
                sessionIndex: (i + 1),
                sessionTotal: numberOfBooksToGenerate//,
                // TODO: try this
                //emitter: io.sockets.emit
            }).then(
                function (book) {
                    numberOfBooksGenerated += 1;
                    io.sockets.emit("book-generated", numberOfBooksGenerated, numberOfBooksToGenerate);
                    if (numberOfBooksGenerated >= numberOfBooksToGenerate) {
                        io.sockets.emit("all-books-generated", numberOfBooksGenerated);
                    }

                }, function (err) {
                    error.handle(err, { response: response });
                }
            );
        }
    }
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
 * Push messages           : all-books-removed { }
 */
app.post("/library/books/clean", function (request, response) {
    if (!useCQRS) {
        console.warn("URI '/library/books/clean' posted when no application store in use!");
        response.send(202);
    } else {
        response.send(205);
    }
    return mongoose.connection.collections[Book.collectionName()].drop(function (err) {
        if (error.handle(err, { response: response })) {
            return null;
        }
        return io.sockets.emit("all-books-removed");
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
            function (err, count) {
                if (error.handle(err, { response: response })) {
                    return null;
                }
                return response.send(200, { count: count });
            });
    }
    // No CQRS, rather event store scanning using mapreduce ...
    return count(eventSourcing.StateChange).then(function (count) {
        if (count <= 0) {
            return response.send(200, { count: 0 });
        }
        var mapReduceConfig = {
            query: { type: Book.modelName },
            map: eventSourcing.mapReduce_map_groupByEntityId,
            reduce: eventSourcing.mapReduce_reduce_replayStateChangeEvents,
            finalize: eventSourcing.mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects,
            out: { replace: "filteredBooks", inline: 1 }
        };
        return eventSourcing.StateChange.mapReduce(mapReduceConfig, function (err, results) {
            if (err) {
                if (err.message === "ns doesn't exist") {
                    console.warn(err);
                    response.send(200, { count: 0 });
                } else {
                    error.handle(err, { response: response });
                }
            }

            // Filter results and count the remaining ...
            return results.find(
                { "value.title": titleRegexp, "value.author": authorRegexp },
                "value.seq",
                function (err, books) {
                    if (!error.handle(err, { response: response })) {
                        response.send(200, { count: books.length });
                    }
                }
            );
        });
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

        sortQuery_mapreduce = { "value.seq": "asc" };
    }

    if (useCQRS) {
        return count(Book).then(function (totalCount) {
            return Book.count(findQuery, function (err, count) {
                return Book
                    .find(findQuery)
                    .sort({ seq: "asc" })
                    .skip(skip)
                    .limit(limit)
                    .exec(function (err, books) {
                        return response.send(200, { books: books, count: count, totalCount: totalCount });
                    });
            });
        });

    } else {
        // No CQRS, rather event store scanning using mapreduce ...
        return count(eventSourcing.StateChange).then(function (count) {
            if (count <= 0) {
                return response.send(200, { books: [], count: 0, totalCount: 0 });
            }
            // TODO: factor out and move to 'mongoose.event-sourcing.js''
            var mapReduceConfig = {
                query: { type: Book.modelName},
                map: eventSourcing.mapReduce_map_groupByEntityId,
                reduce: eventSourcing.mapReduce_reduce_replayStateChangeEvents,
                finalize: eventSourcing.mapReduce_finalize_roundUpNonReducedSingleStateChangeEventObjects,
                out: {
                    replace: "getAllBooks",
                    inline: 1//,
                    //scope: {
                    //    replayStateChanges: replayStateChanges
                    //}
                }
            };
            return eventSourcing.StateChange.mapReduce(mapReduceConfig, function (err, results) {
                if (err) {
                    if (err.message === "ns doesn't exist") {
                        console.warn(err);
                        return response.send(200, { books: [], count: 0, totalCount: 0 });
                    } else {
                        return error.handle(err, { response: response });
                    }
                }
                return results
                    .find(function (err, totalMapReducedResult) {
                        var totalResult = [];
                        totalMapReducedResult.forEach(function (obj, index) {
                            if (obj.value) {
                                totalResult.push(obj);
                            }
                        });

                        return results
                            .find(findQuery_mapreduce)
                            .exec(function (err, projectedResult) {

                                return results
                                    .find(findQuery_mapreduce)
                                    .sort(sortQuery_mapreduce)
                                    .skip(skip)
                                    .limit(limit)
                                    .exec(function (err, paginatedResult) {
                                        var books = [];
                                        paginatedResult.forEach(function (obj, index) {
                                            if (obj.value) {
                                                obj.value._id = obj._id;
                                                books.push(obj.value)
                                            }
                                        });
                                        return response.send(200, { books: books, count: projectedResult.length, totalCount: totalResult.length });
                                    }
                                );
                            }
                        );
                    }
                );
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
 * Push messages           : book-updated { book: the "BookMongooseSchema" object }
 */
app.put("/library/books/:id", function (request, response) {
    return eventSourcing.getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (!stateChanges || stateChanges[stateChanges.length - 1].method === "DELETE") {
            return response.send(404);
        }
        delete request.body._id;
        var changes = request.body;
        if (_.isEmpty(changes)) {
            console.log("No changes in request ...aborting update");
            return response.send(422, "No changes in update request");
        }
        return eventSourcing.stateChange("UPDATE", Book, request.params.id, changes, randomBooks.randomUser())
            .then(function (change) {
                response.send(201, { entityId: change.entityId });
                if (useCQRS) {
                    // Dispatching of asynchronous message to application store
                    return updateBook(change.entityId, change.changes).then(function (book) {
                        return io.sockets.emit("book-updated", { book: book });
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    return io.sockets.emit("book-updated", { book: eventSourcing.rebuild(Book, change.entityId) });
                }

            }, function (err) {
                error.handle(err, { response: response });
            }
        );
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
 *     201 Created   : a new update event is stored
 *     404 Not Found : when the resource does not exist / already deleted
 * Resource out properties :
 *     entityId : The entity id of the updated book
 * Push messages           : book-removed { entityId: The entity id of the updated book }
 */
app.delete("/library/books/:id", function (request, response) {
    return eventSourcing.getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            return eventSourcing.stateChange("DELETE", Book, request.params.id, null, randomBooks.randomUser())
                .then(function (change) {
                    response.send(200, { entityId: change.entityId });

                    if (useCQRS) {
                        return removeBook(change.entityId).then(function (entityId) {
                            return io.sockets.emit("book-removed", { entityId: entityId });
                        });

                    } else {
                        return io.sockets.emit("book-removed", { entityId: change.entityId });
                    }

                }, function (err) {
                    error.handle(err, { response: response });
                });

        } else {
            return response.send(404);
        }
    });
});
