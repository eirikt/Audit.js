/* global JSON:false */
/* jshint -W024 */

var __ = require("underscore"),
    promise = require("promised-io/promise"),
    all = promise.all,
    seq = promise.seq,

    RQ = require("async-rq"),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,

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
    messenger = require("./messaging"),
    eventSourcing = require("./mongoose.event-sourcing"),
    eventSourcingModel = require("./mongoose.event-sourcing.model"),
    randomBooks = require("./random-books"),

    cqrsService = require("./cqrs-service-api"),
    library = require("./library-model"),


// Some curried Mongoose model requestors
// Just add Mongoose model function and arguments, then use them in RQ pipelines
    rqMongooseJsonStateChange = curry(rq.mongooseJson, eventSourcingModel.StateChange),
    rqMongooseJsonBook = curry(rq.mongooseJson, library.Book),


///////////////////////////////////////////////////////////////////////////////
// Internal state
///////////////////////////////////////////////////////////////////////////////


///////////////////////////////////////////////////////////////////////////////
// Public JavaScript API
///////////////////////////////////////////////////////////////////////////////


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
    _generateBooks = exports.generateBooks = function (request, response) {
        'use strict';
        var totalNumberOfBooksToGenerate = request.body.numberOfBooks,
            count,
            startTime = Date.now(),
            numberOfServerPushEmits = 1000,
            index = 0,
            createBookWithSequenceNumber = [];

        if (!totalNumberOfBooksToGenerate) {
            response.sendStatus(422, 'Property "numberOfBooks" is mandatory');

        } else {
            response.sendStatus(202);

            count = parseInt(totalNumberOfBooksToGenerate, 10);
            messenger.publishAll('creating-statechangeevents', totalNumberOfBooksToGenerate, startTime);

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
                    messenger.publishAll('all-statechangeevents-created');
                }
            );
        }
    },


    /**
     * Admin API :: Purge the entire application store
     * (by creating and sending (posting) a "clean" object/resource to the server)
     *
     * CQRS Query / Application store special
     *
     * HTTP method                  : POST
     * Resource properties incoming : -
     * Status codes                 : 202 Accepted            (when no application store is in use)
     *                                205 Reset Content       (when application store is is use)
     *                                405 Method Not Allowed  (not a POST)
     * Resource properties outgoing : -
     * Event messages emitted       : "all-books-removed"
     */
    _purgeAllBooks = exports.purgeBooks = function (request, response) {
        'use strict';
        /*
         if (!cqrsService.isCqrsActivated()) {
         console.warn('URI "library/books/clean" posted when no application store in use!');
         response.sendStatus(202);
         } else {
         response.sendStatus(205);
         }
         return mongodb.mongoose.connection.collections[library.Book.collectionName()].drop(function (err) {
         if (utils.handleError(err, { response: response })) {
         return null;
         }
         return messenger.publishAll('all-books-removed');
         });
         */
        firstSuccessfulOf
        ([
            sequence([
                rq.if(utils.notHttpMethod('POST', request)),
                rq.return('URI \'' + request.originalUrl + '\' supports POST requests only'),
                utils.send405MethodNotAllowedResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.if(cqrsService.isCqrsNotActivated),
                rq.return('URI \'library/books/clean\' posted when no application store in use'),
                utils.send202AcceptedResponseWithArgAsBody(response)
            ]),
            sequence([
                utils.send205ResetContentResponse(response),
                rq.then(curry(messenger.publishAll, 'all-books-removed'))
            ])
        ])(go);
    },


    /**
     * Library API :: Get total number of books (by creating/posting a count object/resource to the server)
     * (by creating and sending (posting) a "count" object/resource to the server)
     *
     * CQRS Query
     *
     * HTTP method                  : POST
     * Resource properties incoming : "titleSubstring"      (optional, book.title filtering (in conjunction with other filtering properties))
     *                                "authorSubstring"     (optional, book.author filtering (in conjunction with other filtering properties))
     * Status codes                 : 200 OK
     * Resource properties outgoing : "count"               (total number of book entities)
     * Event messages emitted       : -
     */
    _countBooks = exports.countBooks = function (request, response) {
        'use strict';
        var titleSearchRegexString = request.body.titleSubstring;
        var authorSearchRegexString = request.body.authorSubstring;
        var isCountingAllBooks = __.isEmpty(titleSearchRegexString) && __.isEmpty(authorSearchRegexString);

        var rqCountBooks = curry(rqMongooseJsonBook, 'count');
        var countAllBooks = rqCountBooks(null); // No filtering, all books

        // CQRS and no search criteria
        if (isCountingAllBooks && cqrsService.isCqrsActivated()) {
            return firstSuccessfulOf([
                sequence([
                    countAllBooks,
                    utils.send200OkResponseWithArgAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(go);
        }

        // Filtered count / count of projected books
        var searchRegexOptions = 'i';
        var titleRegexp = new RegExp(titleSearchRegexString, searchRegexOptions);
        var authorRegexp = new RegExp(authorSearchRegexString, searchRegexOptions);
        var findQuery = { title: titleRegexp, author: authorRegexp };
        var countBooksWithFilter = rqCountBooks(findQuery);

        var rqCountStateChanges = curry(rqMongooseJsonStateChange, 'count');
        var countAllStateChanges = rqCountStateChanges(null); // No filtering, all state changes

        // TODO: Create common predicate util functions while looking for a decent third-party predicate js lib
        var countPropertyLessThanOne = function (arg) {
            //if (arg.count < 1) {
            //    console.log('arg less than one ...');
            //} else {
            //    console.log('arg NOT less than one ...');
            //}
            return arg.count < 1;
        };

        var countAllBookStateChanges = eventSourcing.count(library.Book, findQuery);

        if (cqrsService.getCqrsStatus()) {
            return firstSuccessfulOf([
                sequence([
                    countBooksWithFilter,
                    utils.send200OkResponseWithArgAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(go);

        } else {
            // No CQRS/application store => scanning event store
            return firstSuccessfulOf([
                sequence([
                    countAllStateChanges,
                    continueIf(countPropertyLessThanOne),
                    //rq.return(0), // Not necessary, I guess - won't be a negative number
                    utils.send200OkResponseWithArgAsBody(response)
                ]),
                sequence([
                    countAllBookStateChanges,
                    utils.send200OkResponseWithArgAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(go);
        }
    },


// TODO: To be replaced by RQ equivalent
    count = function (type) {
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
    },


    /**
     * Library API :: Get a projection of books
     * (by creating and sending (posting) a "projection" object/resource to the server)
     *
     * CQRS Query
     *
     * HTTP method                  : POST
     * Resource properties incoming : "count"           (optional, the number of books for each page (also flag for paginated projection or not))
     *                                "index"           (optional, the starting book index if paginated projection)
     *                                "titleSubstring"  (optional, book.title filtering (in conjunction with other filtering properties))
     *                                "authorSubstring" (optional, book.author filtering (in conjunction with other filtering properties))
     * Status codes                 : 200 OK
     * Resource properties outgoing : "books"           (the book projection (array of "BookMongooseSchema" object resources))
     *                                "count"           (the number of books in resulting projection)
     *                                "totalCount"      (the total (unfiltered) number of books in database collection)
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
            findQuery = null,
            sortQuery = { seq: 'asc' };

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
            return firstSuccessfulOf([
                sequence([
                    eventSourcing.project(library.Book, findQuery, sortQuery, skip, limit),
                    utils.send200OkResponseWithArgAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(go);
        }
    },


    /**
     * Library API :: Update a book
     *
     * CQRS Command
     *
     * HTTP method                  : PUT
     * Resource properties incoming : (a "BookMongooseSchema" object resource)
     * Status codes                 : 201 Created                               (new update event is stored)
     *                                400 Bad Request                           (when request body is empty)
     *                                404 Not Found                             (when the resource does not exist)
     *                                405 Method Not Allowed                    (not a PUT)
     * Resource properties outgoing : "entityId"                                (the entity id of the deleted book)
     *                                "stateChanges"                            (the stored state changes))
     * Event messages emitted       : "book-updated(book)"                      ("book": the updated entity)
     */
    _updateBook = exports.updateBook = function (request, response) {
        'use strict';

        var entityId = request.params.entityId,
            requestBody = request.body;

        firstSuccessfulOf([
            sequence([
                rq.if(utils.notHttpMethod('PUT', request)),
                rq.return('URI \'' + request.originalUrl + '\' supports PUT requests only'),
                utils.send405MethodNotAllowedResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.if(utils.isMissing(entityId)),
                rq.return('Mandatory resource element \'entityId\' is missing'),
                utils.send400BadRequestResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.if(utils.isMissing(requestBody)),
                rq.return('Mandatory request body is missing'),
                utils.send400BadRequestResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.if(utils.isEmpty(requestBody)),
                rq.return('Mandatory request body is not valid'),
                utils.send400BadRequestResponseWithArgAsBody(response)
            ]),
            sequence([
                eventSourcing.getStateChangesByEntityId(entityId),
                rq.push,
                rq.if(eventSourcingModel.notEntityExists),
                rq.return('No entity with entityId=\'' + entityId + '\' found'),
                utils.send404NotFoundResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.pop,
                eventSourcing.createAndSaveStateChange('UPDATE', library.Book, entityId, requestBody, randomBooks.randomUser()),
                utils.send201CreatedResponse(['entityId', 'changes'], response),

                // Nope, use events only, delegate this to some handler!
                //firstSuccessfulOf([
                //    sequence([
                //        rq.if(cqrsService.isCqrsActivated),

                //        // TODO: If dispatching of asynchronous message to application store fails, notify originating client (only)
                //        library.Book.update
                //    ]),
                //    rq.noop // Just to complete this "firstSuccessfulOf" requestor chain (RQ.fallback)
                //]),

                eventSourcing.getStateChangesByEntityId(entityId),
                eventSourcing.rebuildEntity(library.Book, entityId),
                rq.then(curry(messenger.publishAll, 'book-updated'))
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
     * Status codes                 : 201 Created                   (a new update event is stored)
     *                                400 Bad Request               (missing "entityType" resource element)
     *                                404 Not Found                 (when the resource does not exist, or is already removed)
     *                                405 Method Not Allowed        (not a DELETE)
     * Resource properties outgoing : "entityId"                    (the entity id of the removed book)
     * Event messages emitted       : "book-removed(entityId)"      ("entityId": the entity id of the removed book)
     */
    _removeBook = exports.removeBook = function (request, response) {
        'use strict';
        var entityId = request.params.entityId;

        firstSuccessfulOf
        ([
            sequence([
                rq.if(utils.notHttpMethod('DELETE', request)),
                rq.return('URI \'' + request.originalUrl + '\' supports DELETE requests only'),
                utils.send405MethodNotAllowedResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.if(utils.isMissing(entityId)),
                rq.return('Mandatory resource element \'entityId\' is missing'),
                utils.send400BadRequestResponseWithArgAsBody(response)
            ]),
            sequence([
                eventSourcing.getStateChangesByEntityId(entityId),
                rq.push,
                rq.if(eventSourcingModel.notEntityExists),
                rq.return('No entity with entityId=' + entityId + ' found'),
                utils.send404NotFoundResponseWithArgAsBody(response)
            ]),
            sequence([
                rq.pop,
                eventSourcing.createAndSaveStateChange('DELETE', library.Book, entityId, null, randomBooks.randomUser()),
                utils.send201CreatedResponseWithArgAsBody(response),

                // Nope, use events only, delegate this to some handler!
                //firstSuccessfulOf([
                //    sequence([
                //        rq.if(cqrsService.isCqrsActivated),
                //        library.Book.remove
                //    ]),
                //    rq.noop // Just to complete this "firstSuccessfulOf" requestor chain (RQ.fallback)
                //]),

                rq.pick('entityId'),
                rq.then(curry(messenger.publishAll, 'book-removed'))
            ]),
            utils.send500InternalServerErrorResponse(response)
        ])(go);
    };
