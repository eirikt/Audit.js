///////////////////////////////////////////////////////////////////////////////
// Main library application server / service API
///////////////////////////////////////////////////////////////////////////////

// Module dependencies, external
var application_root = __dirname,
    _ = require("underscore"),
    promise = require("promised-io/promise"),
    all = promise.all,
    seq = promise.seq,
    bodyParser = require("body-parser"),
    path = require("path"),

//socketio = require("socket.io"),
// TODO: Consider replacing socket.io with sockjs: https://github.com/sockjs/sockjs-client
// https://github.com/LearnBoost/socket.io/issues/463
//sockjs = require("sockjs"),

//http = require("http"),

//express = require("express"),
//bodyParser = require("body-parser"),
// TODO: Consider replacing express with Koa: http://koajs.com
//koa = require('koa'),

    mongodb = require("mongodb"),
    mongoose = require("mongoose"),


// Module dependencies, local
    error = require("./error.js"),
    eventSourcing = require("./mongoose.event-sourcing.js"),
    randomBooks = require("./random-books.js"),


// MongoDB URL
    dbUrl = "mongodb://localhost/library";


// Mongoose schemas
var KeywordMongooseSchema = new mongoose.Schema({
    keyword: String
});

var BookMongooseSchema = new mongoose.Schema({
    seq: Number,
    title: {type: String, index: true},
    author: {type: String, index: true},
    //releaseDate: Date,  // Not yet supported
    //coverImage: String, // Not yet supported
    keywords: {type: [KeywordMongooseSchema], index: true}
});


// Mongoose models (designated as "entity types" in Audit.js) (design rule: lower-case collection names)
var Keyword = mongoose.model("keyword", KeywordMongooseSchema);

var Book = mongoose.model("book", BookMongooseSchema);
Book.collectionName = function () {
    return Book.modelName + "s".toLowerCase();
};


// Generic Mongoose functions
function count(type) {
    var dfd = new promise.Deferred();
    type.count(function (err, count) {
        if (err) {
            return error.handle(
                {message: "Error when counting collection " + eventSourcing.collectionName(type) + " (" + err.message + ")"},
                {deferred: dfd});
        }
        return dfd.resolve(count)
    });
    return dfd.promise;
}


// Application-specific functions
function updateBook(id, changes) {
    var dfd = new promise.Deferred();
    Book.findByIdAndUpdate(id, changes, function (err, book) {
        if (error.handle(err, {deferred: dfd})) {
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
        if (!error.handle(err, {deferred: dfd})) {
            console.log("Book [id=" + id + "] deleted ...OK");
            dfd.resolve(id);
        }
    });
    return dfd.promise;
}
// /Application-specific functions


// Connect to database via MongoDB native driver
var db;
mongodb.MongoClient.connect(dbUrl, function (err, mongodb) {
    db = mongodb;
});


// Connect to database via Mongoose
mongoose.connect(dbUrl);

// Establish Express app server
//var app = require('express')();

//var app = express();
//app.use(bodyParser.json());
//app.use(express.static(path.join(application_root, "../../client")));

//var server = http.Server(app);

var port = 4711;

var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.use(bodyParser.json());
app.use(require('express').static(path.join(application_root, "../../client")));

//server.listen(app.get('port')); // not 'app.listen'!

//var server = http.createServer(app);

server.listen(port, function () {
    console.log("Express server listening on port %d", port);
});


// Establish Server Push / Socket.IO manager
//var io = socketio.listen(server, function(){
//    console.log("Socket.io: listening on port %d", port);
//});
//io.set('transports', ['websocket', 'xhr-polling', 'jsonp-polling', 'htmlfile', 'flashsocket']);
//io.set('origins', '*127.0.0.1:4711');

var userCounter = 0;
io.on("connection", function (socket) {
    console.log("Socket.io: User connected ...");
    userCounter += 1;
    socket.on('disconnect', function () {
        console.log("Socket.io: User disconnected!");
        userCounter -= 1;
    });
});


/**
 * Emitting of current number of users.
 */
setInterval(function () {
    console.log("Number of connected users: " + userCounter);
    io.emit("number-of-connections", userCounter);
}, 10000);


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
 *     'createCount' : The number of CREATE state change events (HTTP POSTs)
 *     'updateCount' : The number of UPDATE state change events (HTTP PUTs)
 *     'deleteCount' : The number of DELETE state change events (HTTP DELETEs)
 *     'totalCount'  : The total number of state change events in event store
 * Push messages           : -
 */
app.get("/events/count", function (request, response) {
    return eventSourcing.StateChange.count({method: "CREATE"}, function (err, createCount) {
        return eventSourcing.StateChange.count({method: "UPDATE"}, function (err, updateCount) {
            return eventSourcing.StateChange.count({method: "DELETE"}, function (err, deleteCount) {
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
 *     'cqrs' (CQRS status)
 */
app.post("/events/cqrs/toggle", function (request, response) {
    response.send(202);
    if (useCQRS) {
        console.log("Bypassing application store - will use event store only!");
    } else {
        console.log("Activating application store ...");
    }
    useCQRS = !useCQRS;
    io.emit("cqrs", useCQRS);
    if (useCQRS) {
        eventSourcing.replayAllStateChanges(Book, io, db);
    }
});


/**
 * Admin API :: Replay the entire <em>event store</em> into the <em>application store</em>.
 * (by creating and sending (posting) a "replay" object/resource to the app.)
 *
 * This is an idempotent operation, as already existing domain objects will not be overwritten.
 * For complete re-creation of the application store, purge it before replaying event store.
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
 *     'mapreducing-events'    (the total number, start timestamp)
 *     'event-mapreduced'      (the total number, start timestamp, current progress)
 *     'all-events-mapreduced' ()
 *
 *     'replaying-events'      (the total number, start timestamp)
 *     'event-replayed'        (the total number, start timestamp, current progress)
 *     'all-events-replayed'   ()
 */
app.post("/events/replay", function (request, response) {
    "use strict";
    if (!useCQRS) {
        var msg = "URI '/events/replay' posted when no application store in use!";
        console.warn(msg);
        return response.send(403, msg);
    }
    response.send(202);
    return eventSourcing.replayAllStateChanges(Book, io, db);
});


/**
 * Admin API :: Generate books randomly
 * (by creating and sending (posting) a "generate" object/resource to the server)
 *
 * CQRS Command
 *
 * HTTP method                  : POST
 * URI                          : /library/books/generate
 * Resource properties incoming :
 *     numberOfBooks : number of books to generate, mandatory
 * Status codes                 :
 *     202 Accepted
 *     422 Unprocessable Entity : Missing mandatory property "numberOfBooks"
 * Resource properties outgoing : -
 * Push messages                :
 *     'creating-statechangeevents'    (the total number, start timestamp)
 *     'statechangeevent-created'      (the total number, start timestamp, current progress)
 *     'all-statechangeevents-created' ()
 *
 *     'mapreducing-events'            (the total number, start timestamp)
 *     'event-mapreduced'              (the total number, start timestamp, current progress)
 *     'all-events-mapreduced'         ()
 *
 *     'replaying-events'              (the total number, start timestamp)
 *     'event-replayed'                (the total number, start timestamp, current progress)
 *     'all-events-replayed'           ()
 */
app.post("/library/books/generate", function (request, response) {
    var totalNumberOfBooksToGenerate = request.body.numberOfBooks,
        count,
        startTime = Date.now(),
        numberOfServerPushEmits = 1000,
        index = 0,
        createBookWithSequenceNumber = [];

    if (!totalNumberOfBooksToGenerate) {
        response.send(422, "Property 'numberOfBooks' is mandatory");

    } else {
        response.send(202);

        count = parseInt(totalNumberOfBooksToGenerate, 10);
        io.emit("creating-statechangeevents", totalNumberOfBooksToGenerate, startTime);

        // Create partially applied functions of all books to be generated
        for (; index < count; index += 1) {
            createBookWithSequenceNumber.push(
                _.partial(eventSourcing.createSequenceNumberEntity,
                    Book,
                    randomBooks.createRandomBookAttributes(Keyword),
                    randomBooks.randomUser(),
                    io,
                    startTime,
                    numberOfServerPushEmits,
                    index,
                    count
                )
            );
        }
        // ...and then execute them strictly sequentially
        //all(seq(createBookWithSequenceNumber)).then(
        seq(createBookWithSequenceNumber).then(
            function () {
                io.emit("all-statechangeevents-created");
                if (useCQRS) {
                    eventSourcing.replayAllStateChanges(Book, io, db);
                }
            }
        )
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
 * Push messages           :
 *     'all-books-removed' ()
 */
app.post("/library/books/clean", function (request, response) {
    if (!useCQRS) {
        console.warn("URI '/library/books/clean' posted when no application store in use!");
        response.send(202);
    } else {
        response.send(205);
    }
    return mongoose.connection.collections[Book.collectionName()].drop(function (err) {
        if (error.handle(err, {response: response})) {
            return null;
        }
        return io.emit("all-books-removed");
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
            return response.send(200, {count: count});
        });
    }

    // Filtered/projection count
    var searchRegexOptions = "i",
        titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions),
        authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions),
        findQuery = {title: titleRegexp, author: authorRegexp};

    if (useCQRS) {
        return Book.count(findQuery, function (err, count) {
            if (error.handle(err, {response: response})) {
                return null;
            }
            return response.send(200, {count: count});
        });
    }
    // No CQRS, rather scanning event store
    return count(eventSourcing.StateChange).then(function (count) {
        if (count <= 0) {
            return response.send(200, {count: 0});
        }
        return eventSourcing.count(Book, findQuery)
            .then(
            function (count) {
                response.send(200, {count: count});

            }, function (err) {
                if (err.message === "ns doesn't exist") {
                    console.warn(err);
                    response.send(200, {count: 0});
                } else {
                    error.handle(err, {response: response});
                }
            }
        );
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
        doPaginate = (numberOfBooksForEachPage),

        skip = 0,
        limit = null,

    // Filtering
        titleSearchRegexString = request.body.titleSubstring,
        authorSearchRegexString = request.body.authorSubstring,
        doFilter = !(_.isEmpty(titleSearchRegexString) && _.isEmpty(authorSearchRegexString)),

        searchRegexOptions = null,
        titleRegexp = null,
        authorRegexp = null,
        findQuery = null,
        sortQuery = {seq: "asc"};

    if (doPaginate) {
        limit = parseInt(numberOfBooksForEachPage, 10);
        if (indexOfFirstBook) {
            skip = parseInt(indexOfFirstBook, 10);
        }
    }
    if (doFilter) {
        searchRegexOptions = "i";
        titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions);
        authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions);
        findQuery = {title: titleRegexp, author: authorRegexp};
    }

    if (useCQRS) {
        return count(Book).then(function (totalCount) {
            return Book.count(findQuery, function (err, count) {
                error.handle(err, {response: response});
                return Book.find(findQuery).sort(sortQuery).skip(skip).limit(limit).exec(
                    function (err, books) {
                        error.handle(err, {response: response});
                        return response.send(200, {books: books, count: count, totalCount: totalCount});
                    }
                );
            });
        });

    } else {
        return eventSourcing.project(Book, findQuery, sortQuery, skip, limit)
            .then(
            function (books, count, totalCount) {
                return response.send(200, {books: books, count: count, totalCount: totalCount});
            },
            function (err) {
                if (err.message === "ns doesn't exist") {
                    console.warn(err);
                    return response.send(200, {count: 0});
                } else {
                    return error.handle(err, {response: response});
                }
            }
        );
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
 * Push messages           :
 *     'book-updated' ("BookMongooseSchema" object)
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
        return eventSourcing.createStateChange("UPDATE", Book, request.params.id, changes, randomBooks.randomUser())
            .then(function (change) {
                response.send(201, {entityId: change.entityId});
                if (useCQRS) {
                    // Dispatching of asynchronous message to application store
                    return updateBook(change.entityId, change.changes).then(function (book) {
                        return io.emit("book-updated", book);
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    // TODO: Does this synchronous entity rebuild really work with this immediate server push?
                    return io.emit("book-updated", eventSourcing.rebuild(Book, change.entityId));
                }

            }, function (err) {
                error.handle(err, {response: response});
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
 * Push messages           :
 *     'book-removed' (The entity id of the deleted book)
 */
app.delete("/library/books/:id", function (request, response) {
    return eventSourcing.getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            return eventSourcing.createStateChange("DELETE", Book, request.params.id, null, randomBooks.randomUser())
                .then(function (change) {
                    response.send(200, {entityId: change.entityId});

                    if (useCQRS) {
                        return removeBook(change.entityId).then(function (entityId) {
                            return io.emit("book-removed", entityId);
                        });

                    } else {
                        return io.emit("book-removed", change.entityId);
                    }

                }, function (err) {
                    error.handle(err, {response: response});
                });

        } else {
            return response.send(404);
        }
    });
});
