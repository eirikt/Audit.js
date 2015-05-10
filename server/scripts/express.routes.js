/* global JSON:false, _:false, promise:false */
/* jshint -W024, -W079 */

var __ = require("underscore"),
    promise = require("promised-io/promise"),
    all = promise.all,
    seq = promise.seq,

    RQ = require("async-rq"),
    sequence = RQ.sequence,
    fallback = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,

    rq = require("rq-essentials"),
    then = rq.then,
    continueIf = rq.if,
    go = rq.execute,

    curry = require("./fun").curry,
    utils = require("./utils"),

    mongodb = require("./mongodb.config"),
    db = mongodb.db,
    mongoose = mongodb.mongoose,
    app = require("./express.config").appServer,
    io = require("./socketio.config").serverPush,

    eventSourcing = require("./mongoose.event-sourcing"),
    eventSourcingModel = require("./mongoose.event-sourcing.model"),
    eventSourcingService = require("./eventsourcing-service-api"),
    cqrsService = require("./cqrs-service-api"),
    library = require("./library-model"),
//libraryService = require("./library-service-api"),
    randomBooks = require("./random-books");


// TODO: Move to 'library-service-api.js''
// Some curried Mongoose model requestors
// Just add Mongoose model function and arguments, then use them in RQ pipelines
var rqMongooseJsonStateChange = curry(rq.mongooseJson, eventSourcingModel.StateChange);
var rqMongooseJsonBook = curry(rq.mongooseJson, library.Book);


// TODO: To be replaced by RQ equivalents
function count(type) {
    "use strict";
    var dfd = new promise.Deferred();
    type.count(function (err, count) {
        if (err) {
            return utils.handleError(
                { message: "Error when counting collection " + eventSourcing.collectionName(type) + " (" + err.message + ")" },
                { deferred: dfd });
        }
        return dfd.resolve(count);
    });
    return dfd.promise;
}


///////////////////////////////////////////////////////////////////////////////
// Main server configuration:
// The Event Sourcing/CQRS resources
///////////////////////////////////////////////////////////////////////////////

app.get("/cqrs/status", cqrsService.status);
app.post("/cqrs/toggle", cqrsService.toggle);

app.get("/events/:entityId", eventSourcingService.events);
app.post("/events/count", eventSourcingService.count);
app.post("/events/replay", eventSourcingService.replay);


///////////////////////////////////////////////////////////////////////////////
// Main server configuration:
// The Library domain resources
///////////////////////////////////////////////////////////////////////////////

// TODO: Move the rest to 'library-service-api.js''
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
        utils.publish("creating-statechangeevents", totalNumberOfBooksToGenerate, startTime);

        // Create partially applied functions of all books to be generated
        for (; index < count; index += 1) {
            createBookWithSequenceNumber.push(
                __.partial(eventSourcing.createSequenceNumberEntity,
                    library.Book,
                    randomBooks.createRandomBookAttributes(library.Keyword),
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
        seq(createBookWithSequenceNumber).then(
            function () {
                utils.publish("all-statechangeevents-created");
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
 * Status codes            : 202 Accepted      : When no application store is in use
 *                           205 Reset Content : When application store is is use
 * Resource out properties : -
 * Push messages           : 'all-books-removed' ()
 */
app.post("/library/books/clean", function (request, response) {
    'use strict';
    if (!cqrsService.isCqrsActivated()) {
        console.warn("URI '/library/books/clean' posted when no application store in use!");
        response.sendStatus(202);
    } else {
        response.sendStatus(205);
    }
    return mongodb.mongoose.connection.collections[library.Book.collectionName()].drop(function (err) {
        if (utils.handleError(err, { response: response })) {
            return null;
        }
        return utils.publish("all-books-removed");
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
    "use strict";
    var titleSearchRegexString = request.body.titleSubstring;
    var authorSearchRegexString = request.body.authorSubstring;
    var isCountingAllBooks = __.isEmpty(titleSearchRegexString) && __.isEmpty(authorSearchRegexString);

    var rqCountBooks = curry(rqMongooseJsonBook, "count");
    var countAllBooks = rqCountBooks(null); // No filtering, all books

    var doLog = true, doNotLog = false;
    var sendCountResponse = rq.dispatchResponseWithScalarBody(doLog, 200, response);
    var sendInternalServerErrorResponse = rq.dispatchResponseStatusCode(doLog, 500, response);

    // CQRS and no search criteria
    if (isCountingAllBooks && cqrsService.isCqrsActivated()) {
        return fallback([
            sequence([
                countAllBooks,
                sendCountResponse
            ]),
            sendInternalServerErrorResponse
        ])(go);
    }

    // Filtered count / count of projected books
    var searchRegexOptions = "i";
    var titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions);
    var authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions);
    var findQuery = { title: titleRegexp, author: authorRegexp };
    var countBooksWithFilter = rqCountBooks(findQuery);

    var rqCountStateChanges = curry(rqMongooseJsonStateChange, "count");
    var countAllStateChanges = rqCountStateChanges(null); // No filtering, all state changes

    // TODO: Create common predicate util functions while looking for a decent third-party predicate js lib
    var countPropertyLessThanOne = function (arg) {
        //if (arg.count < 1) {
        //    console.log("arg less than one ...");
        //} else {
        //    console.log("arg NOT less than one ...");
        //}
        return arg.count < 1;
    };

    var countAllBookStateChanges = eventSourcing.count(library.Book, findQuery);

    if (cqrsService.getCqrsStatus()) {
        return fallback([
            sequence([
                countBooksWithFilter,
                sendCountResponse
            ]),
            sendInternalServerErrorResponse
        ])(go);

    } else {
        // No CQRS/application store => scanning event store
        return fallback([
            sequence([
                countAllStateChanges,
                continueIf(countPropertyLessThanOne),
                //rq.return(0), // Not necessary, I guess - won't be a negative number
                sendCountResponse
            ]),
            sequence([
                countAllBookStateChanges,
                sendCountResponse
            ]),
            sendInternalServerErrorResponse
        ])(go);
    }
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
        doFilter = !(__.isEmpty(titleSearchRegexString) && __.isEmpty(authorSearchRegexString)),

        searchRegexOptions = null,
        titleRegexp = null,
        authorRegexp = null,
        findQuery = null,
        sortQuery = { seq: "asc" },

        doLog = true,
        sendOkResponse = rq.dispatchResponseWithScalarBody(doLog, 200, response),
        sendInternalServerErrorResponse = rq.dispatchResponseStatusCode(doLog, 500, response);

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

    // TODO: RQ'ify this christmas tree ...
    if (cqrsService.isCqrsActivated()) {
        return count(library.Book).then(function (totalCount) {
            return library.Book.count(findQuery, function (err, count) {
                if (!utils.handleError(err, { response: response })) {
                    return library.Book.find(findQuery).sort(sortQuery).skip(skip).limit(limit).exec(function (err, books) {
                        if (!utils.handleError(err, { response: response })) {
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
        return fallback([
            sequence([
                eventSourcing.project(library.Book, findQuery, sortQuery, skip, limit),
                sendOkResponse
            ]),
            sendInternalServerErrorResponse
        ])(go);
    }
});


/**
 * Library API :: Update a book
 *
 * CQRS Command
 *
 * HTTP method                  : PUT
 * URI                          : /library/books/{id}
 * Resource in properties       : (a "BookMongooseSchema" object resource)
 * Status codes            :
 *     201 Created              : a new update event is stored
 *     404 Not Found            : when the resource does not exist
 *     422 Unprocessable Entity : when request body is empty
 * Resource out properties      : entityId : The entity id of the updated book
 * Push messages                : 'book-updated' ("BookMongooseSchema" object)
 */
app.put("/library/books/:id", function (request, response) {
    'use strict';
    return eventSourcing.getStateChangesByEntityId(request.params.id).then(function (stateChanges) {
        if (!stateChanges || stateChanges[stateChanges.length - 1].method === "DELETE") {
            return response.send(404);
        }
        delete request.body._id;
        var changes = request.body;
        if (__.isEmpty(changes)) {
            console.log("No changes in request ...aborting update");
            return response.send(422, "No changes in update request");
        }
        return eventSourcing.createStateChange("UPDATE", library.Book, request.params.id, changes, randomBooks.randomUser())
            .then(function (change) {
                response.status(201).send({ entityId: change.entityId });
                if (cqrsService.isCqrsActivated()) {
                    // Dispatching of asynchronous message to application store
                    return library.Book.update(change.entityId, change.changes).then(function (book) {
                        return utils.publish("book-updated", book);
                    });
                    // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)

                } else {
                    // TODO: Does synchronous entity rebuild really work with this immediate server push?
                    return utils.publish("book-updated", eventSourcing.rebuild(library.Book, change.entityId));
                }

            }, function (err) {
                utils.handleError(err, { response: response });
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
            return eventSourcing.createStateChange("DELETE", library.Book, request.params.id, null, randomBooks.randomUser())
                .then(function (change) {
                    response.send(200, { entityId: change.entityId });

                    if (cqrsService.isCqrsActivated()) {
                        return library.Book.update(change.entityId).then(function (entityId) {
                            return utils.publish("book-removed", entityId);
                        });

                    } else {
                        return utils.publish("book-removed", change.entityId);
                    }

                }, function (err) {
                    utils.handleError(err, { response: response });
                });

        } else {
            return response.send(404);
        }
    });
});
