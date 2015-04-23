/* global JSON:false */
/* jshint -W024 */

///////////////////////////////////////////////////////////////////////////////
// Main library application server / service API
///////////////////////////////////////////////////////////////////////////////

// Module dependencies, external
var applicationRoot = __dirname,
    bodyParser = require('body-parser'),
    path = require('path'),

//socketio = require('socket.io'),
// TODO: Consider replacing socket.io with sockjs: https://github.com/sockjs/sockjs-client
// https://github.com/LearnBoost/socket.io/issues/463
//sockjs = require('sockjs'),

//http = require('http'),

//express = require('express'),
//bodyParser = require("body-parser"),
// TODO: Consider replacing express with Koa: http://koajs.com
//koa = require('koa'),

    mongodb = require("mongodb"),
    mongoose = require("mongoose"),

    promise = require("promised-io/promise"),
    all = promise.all,
    seq = promise.seq,
    RQ = require("async-rq"),
    rq = require("rq-essentials"),
    sequence = RQ.sequence,
    parallel = RQ.parallel,
    fallback = RQ.fallback,
    then = rq.then,
    go = rq.execute,
    _ = require("underscore"),

// Module dependencies, local
    curry = require("./fun").curry,
    error = require("./error"),
    eventSourcing = require("./mongoose.event-sourcing"),
    randomBooks = require("./random-books"),


// MongoDB URL
    dbUrl = "mongodb://localhost/library",


// Mongoose schemas
    KeywordMongooseSchema = new mongoose.Schema({
        keyword: String
    }),

    BookMongooseSchema = new mongoose.Schema({
        seq: Number,
        title: { type: String, index: true },
        author: { type: String, index: true },
        //releaseDate: Date,  // Not yet supported
        //coverImage: String, // Not yet supported
        keywords: { type: [KeywordMongooseSchema], index: true }
    }),


// Mongoose models (designated as "entity types" in Audit.js) (design rule: lower-case collection names)
    Keyword = mongoose.model("keyword", KeywordMongooseSchema),

    Book = mongoose.model("book", BookMongooseSchema);


Book.collectionName = function () {
    "use strict";
    return Book.modelName + "s".toLowerCase();
};


// TODO: To be replaced by RQ equivalents
function count(type) {
    "use strict";
    var dfd = new promise.Deferred();
    type.count(function (err, count) {
        if (err) {
            return error.handle(
                { message: "Error when counting collection " + eventSourcing.collectionName(type) + " (" + err.message + ")" },
                { deferred: dfd });
        }
        return dfd.resolve(count);
    });
    return dfd.promise;
}


// Application-specific functions
function updateBook(id, changes) {
    "use strict";
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
    "use strict";
    var dfd = new promise.Deferred();
    Book.findByIdAndRemove(id, function (err) {
        if (!error.handle(err, { deferred: dfd })) {
            console.log("Book [id=" + id + "] deleted ...OK");
            dfd.resolve(id);
        }
    });
    return dfd.promise;
}
// /Application-specific functions





// TODO: To be moved to https://github.com/eirikt/RQ-essentials-mongoose4
function _rqMongoose4(mongooseModel, mongooseModelFunction, conditions) {
    "use strict";
    var func = _.isString(mongooseModelFunction) ? mongooseModel[mongooseModelFunction] : mongooseModelFunction;

    return function requestor(callback, args) {
        func.call(mongooseModel, conditions, function (err, count) {
            if (err) {
                return callback(undefined, err);
                // TODO:
                //return error.handle(err, { rqCallback: callback });
            }
            return callback(count, undefined);
        });
    };
}

var rqStateChange = curry(_rqMongoose4, eventSourcing.StateChange);
var rqBook = curry(_rqMongoose4, Book);

// TODO: To be moved to https://github.com/eirikt/RQ-essentials-express4
function _rqDispatchResponseStatusCode(response, statusCode) {
    "use strict";
    return function requestor(callback, args) {
        console.log("HTTP Response: " + statusCode);
        response.sendStatus(statusCode);
        return callback(args);
    };
}

// TODO: To be moved to https://github.com/eirikt/RQ-essentials-express4
function _rqDispatchResponseWithBody(response, statusCode, responseKeys) {
    "use strict";
    return function requestor(callback, responseValues) {
        var responseBodyPropertyKeys = _.isArray(responseKeys) ? name : [responseKeys],
            responseBodyPropertyValues = _.isArray(responseValues) ? responseValues : [responseValues],
            responseBody = {};

        _.map(responseBodyPropertyKeys, function (responseBodyPropertyKey, index) {
            responseBody[responseBodyPropertyKey] = responseBodyPropertyValues[index];
        });
        console.log(statusCode + ": " + JSON.stringify(responseBody));
        response.status(statusCode).send(responseBody);
        return callback(responseValues);
    };
}

// TODO: To be moved to https://github.com/eirikt/RQ-essentials-express4
function _response200Ok(response) {
    "use strict";
    return curry(_rqDispatchResponseWithBody, response, 200);
}

// TODO: To be moved to https://github.com/eirikt/RQ-essentials-express4
function _response201Created(response) {
    "use strict";
    return curry(_rqDispatchResponseWithBody, response, 201);
}

// TODO: To be moved to https://github.com/eirikt/RQ-essentials-express4
function _response202Accepted(response) {
    "use strict";
    return curry(_rqDispatchResponseWithBody, response, 202);
}

// TODO: To be moved to https://github.com/eirikt/RQ-essentials-express4
function _response205ResetContent(response) {
    "use strict";
    return curry(_rqDispatchResponseWithBody, response, 205);
}

// TODO: To be moved to https://github.com/eirikt/RQ-essentials-express4
function _response500InternalServerError(response) {
    "use strict";
    return curry(_rqDispatchResponseWithBody, response, 500);
}





// Connect to database via MongoDB native driver
var db;
mongodb.MongoClient.connect(dbUrl, function (err, mongodb) {
    'use strict';
    db = mongodb;
});


// Connect to database via Mongoose
mongoose.connect(dbUrl);

// Establish Express app server
//var app = require('express')();

//var app = express();
//app.use(bodyParser.json());
//app.use(express.static(path.join(applicationRoot, "../../client")));

//var server = http.Server(app);

var port = 4711;

var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

app.use(bodyParser.json());     // To support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // To support URL-encoded bodies
    extended: true
}));
app.use(require('express').static(path.join(applicationRoot, "../../client")));

//server.listen(app.get('port')); // not 'app.listen'!

//var server = http.createServer(app);

server.listen(port, function () {
    'use strict';
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
    'use strict';
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
    'use strict';
    console.log("Number of connected users: " + userCounter);
    io.emit("number-of-connections", userCounter);
}, 10000);


/**
 * The "CQRS usage" flag.
 * This flag indicates whether to use an <em>application store</em> in addition to the <em>event store</em>, CQRS style.
 * The alternative is to use the event store only, being considerately more ineffective ... but as a demo
 * <em>Using event store only is the default (at the moment), just for fun, being reactive.<em>
 */
var useCQRS = false;


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
    "use strict";
    //console.log("/events/count");
    var stateChangeCount = curry(rqStateChange, "count");
    //var stateChange = curry(rqMongoose, eventSourcing.StateChange);
    //var mongooseCount = curry(stateChange, "count");
    sequence([
        parallel([
            stateChangeCount({ method: "CREATE" }),
            stateChangeCount({ method: "UPDATE" }),
            stateChangeCount({ method: "DELETE" })
        ]),
        then(function (args) {
            response.status(200).send({
                createCount: args[0],
                updateCount: args[1],
                deleteCount: args[2],
                totalCount: args[0] + args[1] + args[2]
            });
        })
    ])(go);
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
    'use strict';
    return eventSourcing.getStateChangesByEntityId(request.params.entityId).then(function (stateChanges) {
        return response.status(200).send(stateChanges);
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
app.get("/cqrs/status", function (request, response) {
    'use strict';
    response.status(200).send(useCQRS);
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
app.post("/cqrs/toggle", function (request, response) {
    'use strict';
    response.sendStatus(202);
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
    'use strict';
    var totalNumberOfBooksToGenerate = request.body.numberOfBooks,
        count,
        startTime = Date.now(),
        numberOfServerPushEmits = 1000,
        index = 0,
        createBookWithSequenceNumber = [];

    if (!totalNumberOfBooksToGenerate) {
        response.sendStatus(422, "Property 'numberOfBooks' is mandatory");

    } else {
        response.sendStatus(202);

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
        );
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
    'use strict';
    if (!useCQRS) {
        console.warn("URI '/library/books/clean' posted when no application store in use!");
        response.sendStatus(202);
    } else {
        response.sendStatus(205);
    }
    return mongoose.connection.collections[Book.collectionName()].drop(function (err) {
        if (error.handle(err, { response: response })) {
            return null;
        }
        return io.emit("all-books-removed");
    });
});


// TODO: To be moved to https://github.com/eirikt/RQ-essentials
function _conditional(condition) {
    "use strict";
    return function requestor(callback, args) {
        if (condition.call(this, args)) {
            return callback(args, undefined);
        } else {
            return callback(undefined, "Condition not met");
        }
    };
}


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
    "use strict";
    var titleSearchRegexString = request.body.titleSubstring,
        authorSearchRegexString = request.body.authorSubstring,
        isCountingAllBooks = _.isEmpty(titleSearchRegexString) && _.isEmpty(authorSearchRegexString),

        rqCountBooks = curry(rqBook, "count"),
        countAllBooks = rqCountBooks(null), // No filtering, all books

        sendCountResponse = _rqDispatchResponseWithBody(response, 200, "count"),
        sendInternalServerErrorResponse = _rqDispatchResponseStatusCode(response, 500);

    // CQRS and no search criteria
    if (isCountingAllBooks && useCQRS) {
        return fallback([
            sequence([
                countAllBooks,
                sendCountResponse
            ]),
            sendInternalServerErrorResponse
        ])(go);
    }

    // Filtered count / count of projected books
    var searchRegexOptions = "i",
        titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions),
        authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions),
        findQuery = { title: titleRegexp, author: authorRegexp },
        countBooksWithFilter = rqCountBooks(findQuery),

        rqCountStateChanges = curry(rqStateChange, "count"),
        countAllStateChanges = rqCountStateChanges(null), // No filtering, all state changes
        ifLessThanOne = _conditional(function (arg) {
            //if (arg < 1) {
            //    console.log("arg less than one ...");
            //}
            return arg < 1;
        }),
        countAllEventSourcedBooks = eventSourcing.rqCount(Book, findQuery);


    if (useCQRS) {
        return fallback([
            sequence([
                countBooksWithFilter,
                sendCountResponse
            ]),
            sendInternalServerErrorResponse
        ])(go);
    }
    // No CQRS/application store => scanning event store
    return fallback([
        sequence([
            countAllStateChanges,
            ifLessThanOne,
            //rq.return(0),
            sendCountResponse
        ]),
        sequence([
            countAllEventSourcedBooks,
            sendCountResponse
        ]),
        sendInternalServerErrorResponse
    ])(go);
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
    'use strict';
    // Pagination
    var numberOfBooksForEachPage = request.body.count, // Pagination or not ...
        indexOfFirstBook = request.body.index,
        doPaginate = numberOfBooksForEachPage,

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
        sortQuery = { seq: "asc" };

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
        findQuery = { title: titleRegexp, author: authorRegexp };
    }

    if (useCQRS) {
        return count(Book).then(function (totalCount) {
            return Book.count(findQuery, function (err, count) {
                if (!error.handle(err, { response: response })) {
                    return Book.find(findQuery).sort(sortQuery).skip(skip).limit(limit).exec(function (err, books) {
                        if (!error.handle(err, { response: response })) {
                            return response.status(200).send({
                                books: books,
                                count: count,
                                totalCount: totalCount
                            });
                        }
                    });
                }
            });
        });

    } else {
        return eventSourcing.project(Book, findQuery, sortQuery, skip, limit)
            .then(
            function (result) {
                return response.status(200).send({
                    books: result.books,
                    count: result.count,
                    totalCount: result.totalCount
                });
            },
            function (err) {
                if (err.message === "ns doesn't exist") {
                    console.warn(err);
                    return response.status(200).send({ count: 0 });
                } else {
                    return error.handle(err, { response: response });
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
    'use strict';
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
                response.status(201).send({ entityId: change.entityId });
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
 * Push messages           :
 *     'book-removed' (The entity id of the deleted book)
 */
app.delete("/library/books/:id", function (request, response) {
    'use strict';
    return eventSourcing.getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (stateChanges && stateChanges[stateChanges.length - 1].method !== "DELETE") {
            return eventSourcing.createStateChange("DELETE", Book, request.params.id, null, randomBooks.randomUser())
                .then(function (change) {
                    response.send(200, { entityId: change.entityId });

                    if (useCQRS) {
                        return removeBook(change.entityId).then(function (entityId) {
                            return io.emit("book-removed", entityId);
                        });

                    } else {
                        return io.emit("book-removed", change.entityId);
                    }

                }, function (err) {
                    error.handle(err, { response: response });
                });

        } else {
            return response.send(404);
        }
    });
});