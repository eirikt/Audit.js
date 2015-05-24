/* global app:false, JSON:false */
/* jshint -W024, -W106 */

var __ = require('underscore'),
    httpResponse = require('statuses'),
    httpResponseCode = httpResponse,
    promise = require('promised-io/promise'), // Loose it!
    seq = promise.seq, // Loose it!

    RQ = require('async-rq'),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,

    rq = require('rq-essentials'),
    go = rq.execute,

    curry = require('./fun').curry,
    utils = require('./utils'),

    clientSidePublisher = require("./socketio.config").serverPush,
    messageBus = require("./messaging"),
    eventSourcing = require("./mongoose.event-sourcing"),
    eventSourcingModel = require("./mongoose.event-sourcing.model"),
    randomBooks = require("./random-books"),

    simpleInMemoryDb = require('./library-application-store.naive-inmemory'),
    applicationStores = require('./library-application-store-manager'),
    cqrs = require('./cqrs-service-api'),
    library = require('./library-model'),


///////////////////////////////////////////////////////////////////////////////
// Some curried Mongoose model requestors
// Just add Mongoose model function name and arguments, then use them in RQ pipelines
///////////////////////////////////////////////////////////////////////////////

// Event Store (MongoDB)
    rqMongooseJsonStateChangeInvocation = curry(rq.mongooseJson, eventSourcingModel.StateChange),

// Application Store (In-memory)
    rqInMemoryBookInvocation = null,
    rqInMemoryJsonBookInvocation = null,
    rqInMemoryFindBookInvocation = null,

// Application Store (MongoDB)
    rqMongooseBookInvocation = curry(rq.mongoose, library.Book),
    rqMongooseJsonBookInvocation = curry(rq.mongooseJson, library.Book),
    rqMongooseFindBookInvocation = curry(rq.mongooseFindInvocation, library.Book),


// TODO: Move to 'RQ-essentials.js'
//timedRun = function (successResponseStatusCode, successResponseBody, request, response) {
    timedRun = function (request, response) {
        'use strict';
        return function (success, failure) {
            var failureMessage,
                successMessage,
                uri = request.originalUrl,
                internalServerError = 500,
                statusCode = internalServerError;

            if (success) {
                /*if (__.isFunction(success)) {
                 successMessage = typeof success;

                 } else if (__.isObject(success)) {
                 successMessage = 'Details: ';
                 if (success.name) {
                 successMessage += success.name;
                 if (success.milliseconds) {
                 successMessage += ' after ' + success.milliseconds + ' milliseconds';
                 }
                 } else {
                 successMessage = JSON.stringify(success);
                 }

                 } else*/
                if (__.isNumber(success)) {
                    statusCode = success;
                    successMessage = httpResponse[statusCode];
                    response.status(statusCode).json(successMessage);

                //} else {
                //    successMessage = success;
                }
                console.log('RQ-essentials-express4 :: Resource \'' + uri + '\' processed successfully (' + successMessage + ')');

                if (failure) {
                    console.warn('RQ-essentials-express4 :: Resource \'' + uri + '\' processed successfully, but failure also present (' + failure + ')');
                }

                return;
            }

            if (failure) {
                if (__.isFunction(failure)) {
                    failureMessage = typeof failure;

                } else if (__.isObject(failure)) {
                    failureMessage = 'Details: ';
                    if (failure.name) {
                        failureMessage += failure.name;
                        if (failure.milliseconds) {
                            failureMessage += ' after ' + failure.milliseconds + ' milliseconds';
                        }
                    } else {
                        failureMessage = JSON.stringify(failure);
                    }

                } else if (__.isNumber(failure)) {
                    statusCode = failure;
                    failureMessage = httpResponse[statusCode];

                } else {
                    failureMessage = failure;
                }
                console.error('RQ-essentials-express4 :: Resource \'' + uri + '\' failed! (' + failureMessage + ')');
                response.status(statusCode).json(failureMessage);
            }
        };
    },


///////////////////////////////////////////////////////////////////////////////
// Public REST API
///////////////////////////////////////////////////////////////////////////////

    /**
     * Admin API :: Generate books randomly
     * (by creating and sending (posting) a "generate" object/resource to the server)
     *
     * CQRS Command
     *
     * HTTP method                  : POST
     * Resource properties incoming : numberOfBooks                   (mandatory, number of books to generate)
     * Status codes                 : 202 Accepted
     *                                422 Unprocessable Entity        (missing mandatory property "numberOfBooks")
     * Resource properties outgoing : -
     * Event messages emitted       : "creating-statechangeevents"    (the total number, start timestamp)
     *                                "statechangeevent-created"      (the total number, start timestamp, current progress)
     *                                "all-statechangeevents-created" ()
     *
     *                                "mapreducing-events"            (the total number, start timestamp)
     *                                "event-mapreduced"              (the total number, start timestamp, current progress)
     *                                "all-events-mapreduced"         ()
     *
     *                                "replaying-events"              (the total number, start timestamp)
     *                                "event-replayed"                (the total number, start timestamp, current progress)
     *                                "all-events-replayed"           ()
     */
        // TODO: Rewrite to RQ.js
        // TODO: Delegate to event-sourcing lib
    _generateBooks = exports.generateBooks = function (request, response) {
        'use strict';
        var totalNumberOfBooksToGenerate = request.body.numberOfBooks,
            count,
            startTime = Date.now(),
            numberOfServerPushEmits = 1000,
            index = 0,
            createBookWithSequenceNumber = [];

        if (!totalNumberOfBooksToGenerate) {
            response.sendStatus(422, 'Property \'numberOfBooks\' is mandatory');

        } else {
            response.sendStatus(202);

            count = parseInt(totalNumberOfBooksToGenerate, 10);
            messageBus.publishAll('creating-statechangeevents', totalNumberOfBooksToGenerate, startTime);

            // Create partially applied functions of all books to be generated
            for (; index < count; index += 1) {
                createBookWithSequenceNumber.push(
                    __.partial(eventSourcing.createSequenceNumberEntity,
                        library.Book,
                        randomBooks.createRandomBookAttributes(library.Keyword),
                        randomBooks.randomUser(),
                        clientSidePublisher,
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
                    messageBus.publishAll('all-statechangeevents-created');
                }
            );
        }
    },


    /**
     * Admin API :: Purge the entire application store(s)
     * (by creating and sending (posting) a "clean" object/resource to the server)
     *
     * CQRS Query / Application Store special command
     *
     * HTTP method                  : POST
     * Resource properties incoming : -
     * Status codes                 : 202 Accepted            (when no application store is in use)
     *                                205 Reset Content       (when application store is is use)
     *                                405 Method Not Allowed  (not a POST)
     * Resource properties outgoing : -
     * Event messages emitted       : "remove-all-books"
     */
    _removeAllBooksFromCache = exports.removeAllBooksFromCache = function (request, response) {
        'use strict';
        firstSuccessfulOf
        ([
            sequence([
                rq.if(utils.notHttpMethod('POST', request)),
                rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.if(cqrs.isDisabled),
                rq.value('URI \'library/books/clean\' posted when no application store in use'),
                utils.send202AcceptedResponseWithArgumentAsBody(response)
            ]),
            //sequence([
            //rq.then(curry(messageBus.publishServerSide, 'remove-all-books'))
            // TODO: Or
            //rq.then(applicationStores.removeAllBooks)
            applicationStores.removeAllBooks//,

            //utils.send205ResetContentResponse(response)
            //])
        ], 6000)(timedRun(request, response));
    },


    /**
     * Library API :: Get total number of books (by creating/posting a count object/resource to the server)
     * (by creating and sending (posting) a "count" object/resource to the server)
     *
     * CQRS Query
     *
     * HTTP method                  : POST
     * Resource properties incoming : -
     * Status codes                 : 200 OK
     *                                405 Method Not Allowed    (not a POST)
     * Resource properties outgoing : "count"                   (total number of book entities)
     * Event messages emitted       : -
     */
    _countAllBooks = exports.countAllBooks = function (request, response) {
        'use strict';
        var countAllQuery = null,
            eventStore_CountAllStateChanges = rqMongooseJsonStateChangeInvocation('count', countAllQuery),
            eventStore_CountAllBooks = eventSourcing.count(library.Book, countAllQuery),
            appStore_InMemory_CountAllBooks = simpleInMemoryDb.count(),
            appStore_MongoDb_CountAllBooks = rqMongooseJsonBookInvocation('count', countAllQuery);

        firstSuccessfulOf([
            sequence([
                rq.if(utils.notHttpMethod('POST', request)),
                rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.if(cqrs.isEnabled),
                applicationStores.countAllBooks,//(),
                //rq.then(applicationStores.countAllBooks),
                utils.send200OkResponseWithArgumentAsBody(response)
            ]),
            // Just a demo, not particular useful ...
            sequence([
                eventStore_CountAllStateChanges,
                rq.push,
                rq.pick('count'),
                rq.continueIf(utils.predicates.lessThanOne),
                rq.pop,
                utils.send200OkResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.pop, // Cleaning: If reached this final sequence, the stacked value is not pop'ed - so just pop it and move on
                eventStore_CountAllBooks,
                utils.send200OkResponseWithArgumentAsBody(response)
            ])
            //], 4000)(run(request, response));
        ], 60000)(timedRun(request, response));
    },

/*
 run = function (request, response) {
 'use strict';
 return function (success, failure) {
 var failureMessage,
 uri = request.originalUrl,
 internalServerError = 500;

 if (failure) {
 if (__.isFunction(failure)) {
 failureMessage = typeof failure;

 } else if (__.isObject(failure)) {
 failureMessage = 'Details: ';
 if (failure.name) {
 failureMessage += failure.name;
 if (failure.milliseconds) {
 failureMessage += ' after ' + failure.milliseconds + ' milliseconds';
 }
 } else {
 failureMessage = JSON.stringify(failure);
 }

 } else {
 failureMessage = failure;
 }
 console.error('RQ-essentials-express4 :: Resource \'' + uri + '\' failed! (' + failureMessage + ')');
 response.status(internalServerError).send(failureMessage);
 }
 };
 },
 '*/


    /**
     * Library API :: Get a projection of books
     * (by creating and sending (posting) a "projection" object/resource to the server)
     *
     * CQRS Query
     *
     * HTTP method                  : POST
     * Resource properties incoming : "count"                   (optional, the number of books for each page (also flag for paginated projection or not))
     *                                "index"                   (optional, the starting book index if paginated projection)
     *                                "titleSubstring"          (optional, book.title filtering (in conjunction with other filtering properties))
     *                                "authorSubstring"         (optional, book.author filtering (in conjunction with other filtering properties))
     * Status codes                 : 200 OK
     *                                405 Method Not Allowed    (not a PUT)
     * Resource properties outgoing : "books"                   (the book projection (array of "BookMongooseSchema" object resources))
     *                                "count"                   (the number of books in resulting projection)
     *                                "totalCount"              (the total (unfiltered) number of books in database collection)
     * Event messages emitted       : -
     */
    _projectBooks = exports.projectBooks = function (request, response) {
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
            findAllQuery = null,
            findQuery = findAllQuery,
            sortQuery = { seq: 'asc' },

            rqCountBooks = curry(rqMongooseBookInvocation, 'count');

        if (doPaginate) {
            limit = parseInt(numberOfBooksForEachPage, 10);
            if (indexOfFirstBook) {
                skip = parseInt(indexOfFirstBook, 10);
            }
        }
        if (doFilter) {
            searchRegexOptions = 'i';
            titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions);
            authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions);
            findQuery = { title: titleRegexp, author: authorRegexp };
        }

        var projectBooks = rqMongooseFindBookInvocation(findQuery, sortQuery, skip, limit),
            countBooks = rqCountBooks(findQuery),
            countAllBooks = rqCountBooks(findAllQuery);

        // TODO: If several standalone application stores are available, a RQ "race" is appropriate
        firstSuccessfulOf([
            sequence([
                rq.if(cqrs.isEnabled),
                parallel([
                    projectBooks,
                    countBooks,
                    countAllBooks
                ]),
                rq.then(function (args) {
                    response.status(200).send({
                        books: args[0],
                        count: args[1],
                        totalCount: args[2]
                    });
                })
            ]),
            sequence([
                eventSourcing.project(library.Book, findQuery, sortQuery, skip, limit),
                utils.send200OkResponseWithArgumentAsBody(response)
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])(go);
    },


    /**
     * Library API :: Update a book
     *
     * CQRS Command
     *
     * HTTP method                  : PUT
     * Resource properties incoming : (a "BookMongooseSchema" object resource containing properties to be updated only)
     * Status codes                 : 201 Created                       (new update event is stored)
     *                                400 Bad Request                   (when request body is empty)
     *                                404 Not Found                     (when the resource does not exist)
     *                                405 Method Not Allowed            (not a PUT)
     * Resource properties outgoing : "entityId"                        (the entity id of the deleted book)
     *                                "changes"                         (the stored state changes/updated properties)
     * Event messages emitted       : "book-updated(book)"              ("book": the updated entity)
     */
    _updateBook = exports.updateBook = function (request, response) {
        'use strict';

        var entityId = request.params.entityId,
            requestBody = request.body;

        firstSuccessfulOf([
            sequence([
                rq.if(utils.notHttpMethod('PUT', request)),
                rq.value('URI \'' + request.originalUrl + '\' supports PUT requests only'),
                utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.if(utils.isMissing(entityId)),
                rq.value('Mandatory resource element \'entityId\' is missing'),
                utils.send400BadRequestResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.if(utils.isMissing(requestBody)),
                rq.value('Mandatory request body is missing'),
                utils.send400BadRequestResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.if(utils.isEmpty(requestBody)),
                rq.value('Mandatory request body is not valid'),
                utils.send400BadRequestResponseWithArgumentAsBody(response)
            ]),
            sequence([
                eventSourcing.getStateChangesByEntityId(entityId),
                rq.push,
                rq.if(eventSourcingModel.notEntityExists),
                rq.value('No entity with entityId=\'' + entityId + '\' found'),
                utils.send404NotFoundResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.pop,
                eventSourcing.createAndSaveStateChange('UPDATE', library.Book, entityId, requestBody, randomBooks.randomUser()),
                utils.send201CreatedResponseWithBodyConsistingOf(['entityId', 'changes'], response),
                eventSourcing.getStateChangesByEntityId(entityId),
                eventSourcing.rebuildEntity(library.Book, entityId),
                rq.then(curry(messageBus.publishAll, 'book-updated'))
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])(go);
    },


    /**
     * Library API :: Remove a book
     *
     * CQRS Command
     *
     * HTTP method                  : DELETE
     * Resource properties incoming : -
     * Status codes                 : 201 Created                       (a new update event is stored)
     *                                400 Bad Request                   (missing "entityType" resource element)
     *                                404 Not Found                     (when the resource does not exist, or is already removed)
     *                                405 Method Not Allowed            (not a DELETE)
     * Resource properties outgoing : "entityId"                        (the entity id of the removed book)
     * Event messages emitted       : "book-removed(entityId)"          ("entityId": the entity id of the removed book)
     */
    _removeBook = exports.removeBook = function (request, response) {
        'use strict';
        var entityId = request.params.entityId;

        firstSuccessfulOf([
            sequence([
                rq.if(utils.notHttpMethod('DELETE', request)),
                rq.value('URI \'' + request.originalUrl + '\' supports DELETE requests only'),
                utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.if(utils.isMissing(entityId)),
                rq.value('Mandatory resource element \'entityId\' is missing'),
                utils.send400BadRequestResponseWithArgumentAsBody(response)
            ]),
            sequence([
                eventSourcing.getStateChangesByEntityId(entityId),
                rq.push,
                rq.if(eventSourcingModel.notEntityExists),
                rq.value('No entity with entityId=' + entityId + ' found'),
                utils.send404NotFoundResponseWithArgumentAsBody(response)
            ]),
            sequence([
                rq.pop,
                eventSourcing.createAndSaveStateChange('DELETE', library.Book, entityId, null, randomBooks.randomUser()),
                utils.send201CreatedResponseWithArgumentAsBody(response),
                rq.pick('entityId'),
                rq.then(curry(messageBus.publishAll, 'book-removed'))
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])(go);
    };
