/* global app:false, JSON:false */
/* jshint -W024, -W083, -W106 */

var __ = require('underscore'),

    RQ = require('async-rq'),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,

    rq = require('RQ-essentials'),

    curry = require('./fun').curry,
    utils = require('./utils'),
    not = utils.not,
    isHttpMethod = utils.isHttpMethod,
    isMissing = utils.isMissing,
    isEmpty = utils.isEmpty,
    isNumber = utils.isNumber,

    messageBus = require("./messaging"),
    sequenceNumber = require("./mongoose.sequence-number"),
    eventSourcing = require("./mongoose.event-sourcing"),
    eventSourcingModel = require("./mongoose.event-sourcing.model"),
    randomBooks = require("./random-books"),

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
//    rqInMemoryBookInvocation = null,
//    rqInMemoryJsonBookInvocation = null,
//    rqInMemoryFindBookInvocation = null,

// Application Store (MongoDB)
    rqMongooseBookInvocation = curry(rq.mongoose, library.Book),
//    rqMongooseJsonBookInvocation = curry(rq.mongooseJson, library.Book),
    rqMongooseFindBookInvocation = curry(rq.mongooseFindInvocation, library.Book),


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
     *                                400 Bad Request                 (missing mandatory property "numberOfBooks")
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
    _generateBooks = exports.generateBooks =
        function (request, response) {
            'use strict';

            /* Delebil ... */
            //var totalNumberOfBooksToGenerate = request.body.numberOfBooks,
            //    count,
            //    startTime = Date.now(),
            //    numberOfServerPushEmits = 1000,
            //    index = 0,
            //    createBookWithSequenceNumber = [];

            //if (!totalNumberOfBooksToGenerate) {
            //    response.sendStatus(422, 'Property \'numberOfBooks\' is mandatory');

            //} else {
            //    response.sendStatus(202);

            //    count = parseInt(totalNumberOfBooksToGenerate, 10);
            //    messageBus.publishAll('creating-statechangeevents', totalNumberOfBooksToGenerate, startTime);

            // Create partially applied functions of all books to be generated
            // for (; index < count; index += 1) {
            //     createBookWithSequenceNumber.push(
            //         __.partial(eventSourcing.createSequenceNumberEntity,
            //             // TODO: 'library.Book' shouldn't really be referenced in this file
            //             library.Book,
            //             // TODO: 'library.TagMongooseModel' shouldn't really be referenced in this file
            //             randomBooks.createRandomBookAttributes(library.Tag),
            //             randomBooks.randomUser(),
            //             clientSidePublisher,
            //             startTime,
            //             numberOfServerPushEmits,
            //             index,
            //             count
            //         )
            //     );
            // }
            // ...and then execute them strictly sequentially
            //    seq(createBookWithSequenceNumber).then(
            //        function () {
            //            messageBus.publishAll('all-statechangeevents-created');
            //        }
            //    );
            //}

            var totalNumberOfBooksToGenerate = request.body.numberOfBooks,
                numberOfServerPushEmits = 1000,
                startTime = Date.now(),
                count,
                index = 0,
                createBookWithSequenceNumber = [],

                clientPushMessageThrottlerRequestor = function (numberOfServerPushEmits, startTime, count, index) {
                    return function requestor(callback, savedStateChange) {
                        //console.log('State change event saved ...OK [' + JSON.stringify(savedStateChange) + ']');
                        utils.throttleEvents(numberOfServerPushEmits, count, index, function (progressInPercent) {
                            //console.log('throttleEvents(' + numberOfServerPushEmits + ', ' + count, ', ' + index);
                            messageBus.publishClientSide('statechangeevent-created', count, startTime, progressInPercent);
                            //console.log('publishClientSide(\'statechangeevent-created, ' + count, ', ' + startTime + ', ' + progressInPercent);
                        });
                        callback(savedStateChange, undefined);
                    };
                };

            createBookWithSequenceNumber.push(rq.noop); //Just to make the tests compile/go through

            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('POST', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(isMissing(totalNumberOfBooksToGenerate)),
                    rq.value('Mandatory body parameter \'numberOfBooks\' is missing'),
                    utils.send400BadRequestResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(not(isNumber(totalNumberOfBooksToGenerate))),
                    rq.value('Mandatory body parameter \'numberOfBooks\' is not a number'),
                    utils.send400BadRequestResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    utils.send202AcceptedResponse(response),
                    rq.value(parseInt(totalNumberOfBooksToGenerate, 10)),

                    // TODO: Generic alert: Include in 'RQ-sessentials.js'
                    function (callback, totalNumberOfBooksToGenerate) {
                        count = totalNumberOfBooksToGenerate;
                        callback(totalNumberOfBooksToGenerate, undefined);
                    },

                    rq.then(curry(messageBus.publishAll, 'creating-statechangeevents')),
                    function (callback, args) {
                        for (; index < count; index += 1) {
                            createBookWithSequenceNumber.push(
                                // TODO: Move to 'mongoose.event-sourcing.js'
                                sequence([
                                    function (callback2, args2) {
                                        sequenceNumber.incrementSequenceNumber('books', function (err, nextSequenceNumber) {
                                            callback2(nextSequenceNumber, undefined);
                                        });
                                    },
                                    function (callback2, nextSequenceNumber) {
                                        var entityAttributes = randomBooks.createRandomBookAttributes(library.Tag);
                                        entityAttributes.seq = nextSequenceNumber;
                                        callback2(entityAttributes, undefined);
                                    },
                                    function (callback2, entityAttributes) {
                                        callback2(eventSourcing.createStateChange('CREATE', library.Book, null, entityAttributes, randomBooks.randomUser()), undefined);
                                    },
                                    function (callback2, stateChange) {
                                        stateChange.save(function (err, savedStateChange) {
                                            callback2(savedStateChange, undefined);
                                        });
                                    },
                                    clientPushMessageThrottlerRequestor(numberOfServerPushEmits, startTime, count, index)
                                ])
                            );
                        }
                        callback(args, undefined);
                    },
                    sequence(createBookWithSequenceNumber),
                    rq.then(curry(messageBus.publishAll, 'all-statechangeevents-created'))
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(rq.run);
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
    _removeAllBooksFromCache = exports.removeAllBooksFromCache =
        function (request, response) {
            'use strict';
            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('POST', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(cqrs.isDisabled),
                    rq.value('URI \'library/books/clean\' posted when no application store in use'),
                    utils.send202AcceptedResponseWithArgumentAsBody(response)
                ]),
                applicationStores.removeAllBooks
            ], 6000)(rq.handleTimeoutAndStatusCode(request, response));
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
    _countAllBooks = exports.countAllBooks =
        function (request, response) {
            'use strict';
            var countAllQuery = null,
                eventStore_CountAllStateChanges = rqMongooseJsonStateChangeInvocation('count', countAllQuery),
            // TODO: 'library.Book' shouldn't really be referenced in this file
                eventStore_CountAllBooks = eventSourcing.count(library.Book, countAllQuery);

            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('POST', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(cqrs.isEnabled),
                    applicationStores.countAllBooks,
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
                    // TODO: Could this push/pop thing be solved by initial values argument to requestor/requestor chains?
                    rq.pop, // Cleaning: If reached this final sequence, the stacked value is not pop'ed - so just pop it and move on
                    eventStore_CountAllBooks,
                    utils.send200OkResponseWithArgumentAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ], 60000)(rq.handleTimeout(request, response));
        },


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
        // TODO: Rewrite using application store manager
    _projectBooks = exports.projectBooks =
        function (request, response) {
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
                    // TODO: 'library.Book' shouldn't really be referenced in this file
                    eventSourcing.project(library.Book, findQuery, sortQuery, skip, limit),
                    utils.send200OkResponseWithArgumentAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(rq.run);
        },


    /**
     * Library API :: Update a book
     *
     * CQRS Command
     *
     * HTTP method                  : PUT
     * Resource properties incoming : "entityId"                        (the entity id of the deleted book)
     *                              : (a "BookMongooseSchema" object resource containing properties to be updated only! (Incremental changes/"diff" only))
     * Status codes                 : 201 Created                       (new update event is stored)
     *                                400 Bad Request                   (when request body is empty)
     *                                404 Not Found                     (when the resource does not exist)
     *                                405 Method Not Allowed            (not a PUT)
     * Resource properties outgoing : "entityId"                        (the entity id of the deleted book)
     *                                "changes"                         (the stored state changes/updated properties)
     * Event messages emitted       : "book-updated(book)"              ("book": the updated entity)
     */
    _updateBook = exports.updateBook =
        function (request, response) {
            'use strict';
            var entityId = request.params.entityId;

            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('PUT', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports PUT requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(isMissing(entityId)),
                    rq.value('Mandatory resource element \'entityId\' is missing'),
                    utils.send400BadRequestResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(isMissing(request.body)),
                    rq.value('Mandatory request body is missing'),
                    utils.send400BadRequestResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(isEmpty(request.body)),
                    rq.value('Mandatory request body is not valid'),
                    utils.send400BadRequestResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    eventSourcing.getStateChangesByEntityId(entityId),
                    rq.push,
                    rq.if(not(eventSourcingModel.entityExists)),
                    rq.value('No entity with entityId=\'' + entityId + '\' found'),
                    utils.send404NotFoundResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.pop,
                    // TODO: 'library.Book' shouldn't really be referenced in this file
                    eventSourcing.createAndSaveStateChange('UPDATE', library.Book, entityId, request.body, randomBooks.randomUser()),
                    utils.send201CreatedResponseWithBodyConsistingOf(['entityId', 'changes'], response),
                    eventSourcing.getStateChangesByEntityId(entityId),
                    eventSourcing.rebuildEntity(library.Book, entityId),
                    rq.then(curry(messageBus.publishAll, 'book-updated'))
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(rq.run);
        },


    /**
     * Library API :: Remove a book
     *
     * CQRS Command
     *
     * HTTP method                  : DELETE
     * Resource properties incoming : "entityId"                        (the entity id of the removed book)
     * Status codes                 : 201 Created                       (a new update event is stored)
     *                                400 Bad Request                   (missing "entityType" resource element)
     *                                404 Not Found                     (when the resource does not exist, or is already removed)
     *                                405 Method Not Allowed            (not a DELETE)
     * Resource properties outgoing : "entityId"                        (the entity id of the removed book)
     * Event messages emitted       : "book-removed(entityId)"          ("entityId": the entity id of the removed book)
     */
    _removeBook = exports.removeBook =
        function (request, response) {
            'use strict';
            var entityId = request.params.entityId;

            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('DELETE', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports DELETE requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(isMissing(entityId)),
                    rq.value('Mandatory resource element \'entityId\' is missing'),
                    utils.send400BadRequestResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    eventSourcing.getStateChangesByEntityId(entityId),
                    rq.push,
                    rq.if(not(eventSourcingModel.entityExists)),
                    rq.value('No entity with entityId=' + entityId + ' found'),
                    utils.send404NotFoundResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.pop,
                    // TODO: 'library.Book' shouldn't really be referenced in this file
                    eventSourcing.createAndSaveStateChange('DELETE', library.Book, entityId, null, randomBooks.randomUser()),
                    utils.send201CreatedResponseWithArgumentAsBody(response),
                    rq.pick('entityId'),
                    rq.then(curry(messageBus.publishAll, 'book-removed'))
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(rq.run);
        };
