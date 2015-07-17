/* global JSON:false */
/* jshint -W024, -W083, -W106 */

var __ = require('underscore'),
    httpResponse = require('statuses'),
    mongoose = require('mongoose'),

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
    library = require('./library-model.mongoose'),


///////////////////////////////////////////////////////////////////////////////
// Some curried Mongoose model requestors
// Just add Mongoose model function name and arguments, then use them in RQ pipelines
///////////////////////////////////////////////////////////////////////////////

// Event Store (MongoDB)
    rqMongooseJsonStateChangeInvocation = curry(rq.mongooseJson, utils.doNotLog, eventSourcingModel.StateChange),

// Application Store (In-memory)
    rqInMemoryBookInvocation = null,
    rqInMemoryJsonBookInvocation = null,
    rqInMemoryFindBookInvocation = null,

// Application Store (MongoDB)
    rqMongooseBookInvocation = curry(rq.mongoose, utils.doNotLog, library.Book),
    rqMongooseJsonBookInvocation = curry(rq.mongooseJson, utils.doNotLog, library.Book),
    rqMongooseFindBookInvocation = curry(rq.mongooseFindInvocation, library.Book),


///////////////////////////////////////////////////////////////////////////////
// Public REST API
///////////////////////////////////////////////////////////////////////////////

    /**
     * Admin API :: Generate books randomly
     * (by creating and sending (posting) a transient "generate" object/resource to the server)
     *
     * CQRS Command
     *
     * HTTP method                  : POST
     * Resource properties incoming : numberOfBooks                        (mandatory, number of books to generate)
     * Status codes                 : 201 Created                          (synchronous)
     * Status codes                 : 202 Accepted                         (asynchronous)
     *                                400 Bad Request                      (missing/illegal mandatory property "numberOfBooks")
     * Resource properties outgoing : -
     * Event messages emitted       : "creating-book-statechangeevents"    (the total number, start timestamp)
     *                                "book-statechangeevent-created"      (the total number, start timestamp, current progress in percent)
     *                                "all-book-statechangeevents-created" ()
     *
     *                                "mapreducing-events"                 (the total number, start timestamp)
     *                                "event-mapreduced"                   (the total number, start timestamp, current progress in percent)
     *                                "all-events-mapreduced"              ()
     *
     *                                "replaying-events"                   (the total number, start timestamp)
     *                                "event-replayed"                     (the total number, start timestamp, current progress in percent)
     *                                "all-events-replayed"                ()
     */
    _generateBooks = exports.generateBooks =
        function (request, response) {
            'use strict';

            var totalNumberOfBooksToGenerate = request.body.numberOfBooks,
                numberOfServerPushEmits = 1000,
                startTime = Date.now(),
                count,
                index = 0,
                booksWithSequenceNumber = [],

                clientPushMessageThrottlerRequestor = function (numberOfServerPushEmits, startTime, count, index) {
                    return function requestor(callback, savedBookStateChange) {
                        utils.throttleEvents(numberOfServerPushEmits, count, index, function (progressInPercent) {
                            messageBus.publishClientSide('book-statechangeevent-created', count, startTime, progressInPercent);
                        });
                        callback(savedBookStateChange, undefined);
                    };
                };

            booksWithSequenceNumber.push(rq.noop); // Just to make the tests compile/go through

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
                    // TODO: How to generify this one?
                    function (callback, totalNumberOfBooksToGenerate) {
                        count = totalNumberOfBooksToGenerate;
                        callback(totalNumberOfBooksToGenerate, undefined);
                    },
                    rq.then(curry(messageBus.publishAll, 'creating-book-statechangeevents')),
                    function (callback, args) {
                        for (; index < count; index += 1) {
                            booksWithSequenceNumber.push(
                                // TODO: Move this to 'mongoose.event-sourcing.js' or somewhere else
                                sequence([
                                    function (callback2, args2) {
                                        sequenceNumber.incrementSequenceNumber('books', function (err, nextSequenceNumber) {
                                            callback2(nextSequenceNumber, undefined);
                                        });
                                    },
                                    function (callback2, nextSequenceNumber) {
                                        var entityAttributes = randomBooks.createRandomBookAttributes(library.Tag);
                                        entityAttributes.sequenceNumber = nextSequenceNumber;
                                        callback2(entityAttributes, undefined);
                                    },
                                    function (callback2, entityAttributes) {
                                        callback2(eventSourcing.createStateChange('CREATE', library.Book, null, entityAttributes, randomBooks.randomUser()), undefined);
                                    },
                                    function (callback2, stateChange) {
                                        stateChange.save(function (err, savedBookStateChange) {
                                            callback2(savedBookStateChange, undefined);
                                        });
                                    },
                                    clientPushMessageThrottlerRequestor(numberOfServerPushEmits, startTime, count, index),
                                    rq.then(JSON.stringify),
                                    rq.log(utils.logPreamble() + 'Book CREATE state change event saved ...OK [${args}]')
                                ])
                            );
                        }
                        callback(args, undefined);
                    },
                    sequence(booksWithSequenceNumber),
                    rq.then(curry(messageBus.publishAll, 'all-book-statechangeevents-created'))
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(rq.run);
        },


    /**
     *
     * Admin API :: Generate book loans randomly
     * (by creating and sending (posting) a transient "generate" object/resource to the server)
     *
     * CQRS Command
     *
     * HTTP method                  : POST
     * Resource properties incoming : maxBookLoansPerVisit                  (optional, default is 3)
     * Status codes                 : 201 Created                           (synchronous processing)
     *                                202 Accepted                          (asynchronous processing)
     *                                400 Bad Request                       (illegal property "numberOfBooks")
     * Resource properties outgoing : -
     * Resource properties outgoing : -
     * Event messages emitted       : "creating-visit-statechangeevents"    (the total number, start timestamp)
     *                                "visit-statechangeevent-created"      (the total number, start timestamp, current progress in percent)
     *                                "all-visit-statechangeevents-created" ()
     *
     *                                "mapreducing-events"                  (the total number, start timestamp)
     *                                "event-mapreduced"                    (the total number, start timestamp, current progress in percent)
     *                                "all-events-mapreduced"               ()
     *
     *                                "replaying-events"                    (the total number, start timestamp)
     *                                "event-replayed"                      (the total number, start timestamp, current progress in percent)
     *                                "all-events-replayed"                 ()
     */
    _generateVisitsAndLoans = exports.generateVisitsAndLoans =
        function (request, response) {
            'use strict';
            var totalNumberOfBooks,
                maxBookLoansPerVisit = request.body.maxBookLoansPerVisit || 3,
                numberOfVisitsToGenerate = 0,
                numberOfServerPushEmits = 1000,
                startTime = Date.now(),
                visitIndex = 0,
                visitRequestors = [],
            //bookLoanRequestors,// = [],
                countAllQuery = null,
            // TODO: 'library.Book' shouldn't really be referenced in this file
                eventStore_CountAllBooks = eventSourcing.count(library.Book, countAllQuery),

                clientPushMessageThrottlerRequestorFactory = function (numberOfServerPushEmits, startTime, count, index) {
                    return function requestor(callback, savedVisitStateChange) {
                        utils.throttleEvents(numberOfServerPushEmits, count, index, function (progressInPercent) {
                            messageBus.publishClientSide('visit-statechangeevent-created', count, startTime, progressInPercent);
                        });
                        callback(savedVisitStateChange, undefined);
                    };
                },

                generateLoansRequestorFactory = function (totalNumberOfBooks, numberOfVisitsToGenerate, visitIndex, bookLoanRequestors) {
                    return function (callback, savedVisitStateChange) {
                        console.log(utils.logPreamble() + 'Generating visits and loans: Starting building loan-generating functions ...');
                        var bookLoanInVisitIndex = 0,
                            randomOperator = randomBooks.randomUser(),

                            emitConditionalVisitGenerationTermination = function (totalNumberOfBooks, numberOfVisitsToGenerate, visitIndex, bookLoanInVisitIndex, maxBookLoansPerVisit, bookLoans) {
                                return function requestor(callback, args) {
                                    if ((bookLoanInVisitIndex + 1) >= maxBookLoansPerVisit) {
                                        console.log(utils.logPreamble() + 'Generating visits and loans: Done executing visit-generating function #' + (visitIndex + 1) + ' of ' + numberOfVisitsToGenerate + ' ...');
                                        if ((visitIndex + 1) >= numberOfVisitsToGenerate) {
                                            messageBus.publishAll('all-visit-statechangeevents-created');
                                        }
                                    }
                                    callback(args, undefined);
                                };
                            };

                        bookLoanRequestors = []; // Too avoid requestor sequence failure ... ?

                        // Just to make the tests compile/go through
                        //bookLoanRequestors.push(rq.noop);

                        // DOES NOT WORK: Mutated!
                        //console.log(utils.logPreamble() + 'extra: Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...');

                        for (; bookLoanInVisitIndex < maxBookLoansPerVisit; bookLoanInVisitIndex += 1) {
                            //var loanEntityAttributes;// = {};

                            // DOES NOT WORK: Mutated!
                            //console.log(utils.logPreamble() + 'extra2: Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...');

                            bookLoanRequestors.push(
                                sequence([
                                    //rq.log(utils.logPreamble() + '4 Generating visits and loans: Executing loan-generating function #' + (bookLoanInVisitIndex + 1) + ' of ' + maxBookLoansPerVisit + ', for visit #' + (visitIndex + 1) + ' ...'),
                                    rq.log(utils.logPreamble() + 'Generating visits and loans: Executing loan-generating function #' + (bookLoanInVisitIndex + 1) + ' of ' + maxBookLoansPerVisit + ', for visit #' + (visitIndex + 1) + ' ...'),
                                    eventSourcing.getRandom(library.Book, totalNumberOfBooks),
                                    function (callback3, randomBook) {
                                        if (!randomBook) {
                                            callback3(undefined, 'Generating visits and loans: Unable to get a random book ...');
                                        } else {
                                            callback3(randomBook, undefined);
                                        }
                                    },
                                    rq.log(utils.logPreamble() + 'Generating visits and loans: Random book retrieved: ${args}'),
                                    function (callback3, randomBook) {
                                        var loanEntityAttributes = {};
                                        loanEntityAttributes.target = randomBook.entityId;
                                        callback3(loanEntityAttributes, undefined);
                                    },
                                    function (callback3, loanEntityAttributes) {
                                        sequenceNumber.incrementSequenceNumber('loans', function (err, nextSequenceNumber) {
                                            loanEntityAttributes.sequenceNumber = nextSequenceNumber;
                                            callback3(loanEntityAttributes, undefined);
                                        });
                                    },
                                    // TODO: Include loan in visit entity (bi-directional reference)?
                                    function (callback3, loanEntityAttributes) {
                                        loanEntityAttributes.context = savedVisitStateChange.entityId;
                                        loanEntityAttributes.date = randomBooks.getRandomLoanReturnDateForVisit(savedVisitStateChange);
                                        callback3(eventSourcing.createStateChange('CREATE', library.Loan, null, loanEntityAttributes, randomOperator), undefined);
                                    },
                                    function (callback3, stateChange2) {
                                        stateChange2.save(function (err, savedLoanStateChange) {
                                            //console.log(utils.logPreamble() + 'State change event saved ...OK [' + JSON.stringify(savedLoanStateChange) + ']');
                                            callback3(savedLoanStateChange, undefined);
                                        });
                                    },
                                    rq.then(JSON.stringify),
                                    rq.log(utils.logPreamble() + 'Loan CREATE state change event saved ...OK [${args}]'),

                                    //function (callback3, args) {
                                    //    // Check index to see if it is the last one ...
                                    //    //var myVisitIndex = __.clone(visitIndex);
                                    //    if ((bookLoanInVisitIndex + 1) >= maxBookLoansPerVisit) {
                                    //        console.log(utils.logPreamble() + 'Generating visits and loans: Done executing visit-generating function #' + (visitIndex + 1) + ' of ' + numberOfVisitsToGenerate + ' ...');
                                    //        if ((visitIndex + 1) >= numberOfVisitsToGenerate) {
                                    //            console.log('!! all-visit-statechangeevents-created !!');
                                    //            rq.then(curry(messageBus.publishAll, 'all-visit-statechangeevents-created'));
                                    //        }
                                    //    }
                                    //    callback3(args, undefined);
                                    //}

                                    // TODO: ...
                                    emitConditionalVisitGenerationTermination(totalNumberOfBooks, numberOfVisitsToGenerate, visitIndex, bookLoanInVisitIndex, maxBookLoansPerVisit, bookLoanRequestors)

                                    //] // Not good enough!
                                    //])(rq.run) // OK
                                ])(function (success, failure) { // Full control ...
                                    if (failure || !success) {
                                        //throw new Error('FAILURE :: ' + JSON.stringify(failure));
                                        if (__.isFunction(failure)) {
                                            console.warn(utils.logPreamble() + 'FAILURE: ' + failure.call(this));

                                        } else {
                                            console.warn(utils.logPreamble() + 'FAILURE: ' + JSON.stringify(failure));
                                        }
                                        //} else {
                                        //    console.log(utils.logPreamble() + 'Generating visits and loans: Loan-generating function executed successfully');
                                    }
                                })
                            );
                            //console.log(utils.logPreamble() + 'Generating visits and loans: Loan-generating function #' + bookLoanInVisitIndex + ' pushed to requestor sequence array ...');
                        }
                        //console.log(utils.logPreamble() + 'Generating loans: Done! ' + (bookLoans.length - 1) + ' loan-generating functions pushed to requestor sequence array');
                        callback(savedVisitStateChange, undefined);
                    };
                };//,

            //emitConditionalVisitGenerationTermination = function (totalNumberOfBooks, numberOfVisitsToGenerate, visitIndex, bookLoans) {
            //    return function requestor(callback, args) {
            //        console.log(utils.logPreamble() + 'Generating visits and loans: Done executing visit-generating function #' + (visitIndex + 1) + ' of ' + numberOfVisitsToGenerate + ' ...');
            //        if ((visitIndex + 1) >= numberOfVisitsToGenerate) {
            //            console.log('!! all-visit-statechangeevents-created !!');
            //            rq.then(curry(messageBus.publishAll, 'all-visit-statechangeevents-created'));
            //        }
            //        callback(args, undefined);
            //    };
            //};


            // Just to make the tests compile/go through
            visitRequestors.push(rq.noop);
            //bookLoanRequestors.push(rq.noop);

            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('POST', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    rq.if(not(isNumber(maxBookLoansPerVisit))),
                    rq.value('Optional body parameter \'maxBookLoansPerVisit\' is not a number'),
                    utils.send400BadRequestResponseWithArgumentAsBody(response)
                ]),
                sequence([
                    utils.send202AcceptedResponse(response),

                    // TODO: Consider skipping application store querying here ...
                    // TODO: Use smarter counting - see _'countAllBooks' below ...
                    function (callback, args) {
                        firstSuccessfulOf([
                            sequence([
                                rq.if(cqrs.isEnabled),
                                applicationStores.countAllBooks
                            ]),
                            sequence([
                                eventStore_CountAllBooks
                            ])
                        ])(function (success, failure) {
                            if (success) {
                                totalNumberOfBooks = success.count;
                                console.log(utils.logPreamble() + 'Generating visits and loans: ' + totalNumberOfBooks + ' books found to generate loans for ...');
                                return callback(totalNumberOfBooks, undefined);
                            }
                            if (failure) {
                                // TODO: Handle failure?
                                console.error(utils.logPreamble() + 'Resource \'' + request.originalUrl + '\' failed!');
                                callback(undefined, failure);
                            }
                        });
                    },

                    function (callback, totalNumberOfBooks) {
                        numberOfVisitsToGenerate = Math.ceil(totalNumberOfBooks / 4);
                        //console.log(utils.logPreamble() + 'Generating visits and loans: Will generate ' + numberOfVisitsToGenerate + ' library visits (each including random loans) ...');
                        callback(numberOfVisitsToGenerate, undefined);
                    },

                    rq.then(curry(messageBus.publishAll, 'creating-visit-statechangeevents')),

                    function (callback, numberOfVisitsToGenerate) {
                        //var bookLoans;

                        //// Just to make the tests compile/go through
                        //bookLoans.push(rq.noop);

                        for (; visitIndex < numberOfVisitsToGenerate; visitIndex += 1) {
                            //var myVisitIndex = visitIndex;

                            //bookLoanRequestors = [];
                            var bookLoanRequestors = [];
                            bookLoanRequestors.push(rq.noop); // To avoid 'TypeError: RQ.sequence requestors' ... ?

                            visitRequestors.push(
                                sequence([
                                    // DOES NOT WORK: Mutated!
                                    //function (callback2, args2) {
                                    //    console.log(utils.logPreamble() + '1 Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...');
                                    //    callback2(args2, undefined);
                                    //},
                                    // WORKS!
                                    //rq.log(utils.logPreamble() + '2 Generating visits and loans: Executing visit-generating function #' + (myVisitIndex + 1) + ' ...'),
                                    //rq.log(utils.logPreamble() + '3a Generating visits and loans: Executing visit-generating function #' + visitIndex + ' ...'),
                                    //rq.log(utils.logPreamble() + '3 Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...'),
                                    rq.log(utils.logPreamble() + 'Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...'),
                                    // DOES NOT WORK: Mutated!
                                    //function (callback2, args2) {
                                    //    console.log(utils.logPreamble() + '4 Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...');
                                    //    callback2(args2, undefined);
                                    //},
                                    function (callback2, args2) {
                                        sequenceNumber.incrementSequenceNumber('visits', function (err, nextSequenceNumber) {
                                            callback2(nextSequenceNumber, undefined);
                                        });
                                    },
                                    function (callback2, nextSequenceNumber) {
                                        var entityAttributes = randomBooks.createRandomVisitAttributes();
                                        entityAttributes.sequenceNumber = nextSequenceNumber;
                                        entityAttributes.loanPeriodInDays = library.getStandardLoanPeriodInDays();
                                        callback2(entityAttributes, undefined);
                                    },
                                    function (callback2, entityAttributes) {
                                        callback2(eventSourcing.createStateChange('CREATE', library.Visit, null, entityAttributes, randomBooks.randomUser()), undefined);
                                    },
                                    function (callback2, stateChange) {
                                        stateChange.save(function (err, savedStateChange) {
                                            //console.log(utils.logPreamble() + 'State change event saved ...OK [' + JSON.stringify(savedStateChange) + ']');
                                            callback2(savedStateChange, undefined);
                                        });
                                    },
                                    rq.then(JSON.stringify),
                                    rq.log(utils.logPreamble() + 'Visit CREATE state change event saved ...OK [${args}]'),
                                    //function (callback2, args) {
                                    //    //bookLoanRequestors = [];
                                    //    bookLoanRequestors.push(rq.noop);
                                    //    callback2(args, undefined);
                                    //},
                                    generateLoansRequestorFactory(totalNumberOfBooks, numberOfVisitsToGenerate, visitIndex, bookLoanRequestors),
                                    /*
                                     function (callback2, savedStateChange) {
                                     console.log(utils.logPreamble() + 'Generating visits and loans: Starting building loan-generating functions ...');
                                     var bookLoanInVisitIndex = 0,
                                     randomOperator = randomBooks.randomUser();

                                     bookLoans = [];

                                     // Just to make the tests compile/go through
                                     bookLoans.push(rq.noop);

                                     // DOES NOT WORK: Mutated!
                                     console.log(utils.logPreamble() + 'extra: Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...');

                                     for (; bookLoanInVisitIndex < maxBookLoansPerVisit; bookLoanInVisitIndex += 1) {
                                     var loanEntityAttributes = {};

                                     // DOES NOT WORK: Mutated!
                                     console.log(utils.logPreamble() + 'extra2: Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...');

                                     bookLoans.push(
                                     sequence([
                                     // DOES NOT WORK: 'visitIndex' Mutated! ????
                                     rq.log(utils.logPreamble() + 'Generating visits and loans: Executing loan-generating function #' + (bookLoanInVisitIndex + 1) + ' of ' + maxBookLoansPerVisit + ', for visit #' + (visitIndex + 1) + ' ...'),

                                     rq.log(utils.logPreamble() + '5 Generating visits and loans: Executing visit-generating function #' + (visitIndex + 1) + ' ...'),

                                     eventSourcing.getRandom(library.Book, totalNumberOfBooks),

                                     function (callback3, randomBook) {
                                     if (!randomBook) {
                                     callback3(undefined, 'Generating visits and loans: Unable to get a random book ...');
                                     } else {
                                     callback3(randomBook, undefined);
                                     }
                                     },
                                     rq.log(utils.logPreamble() + 'Generating visits and loans: Random book retrieved: ${args}'),
                                     function (callback3, randomBook) {
                                     loanEntityAttributes.target = randomBook.entityId;
                                     callback3(randomBook, undefined);
                                     },
                                     function (callback3, randomBook) {
                                     sequenceNumber.incrementSequenceNumber('loans', function (err, nextSequenceNumber) {
                                     callback3(nextSequenceNumber, undefined);
                                     });
                                     },
                                     // TODO: Include loan in visit entity (bi-directional reference)?
                                     function (callback3, nextSequenceNumber) {
                                     // TODO: Use an object as argument holder here ...
                                     loanEntityAttributes.sequenceNumber = nextSequenceNumber;
                                     loanEntityAttributes.context = savedStateChange.entityId;
                                     loanEntityAttributes.date = randomBooks.getRandomLoanReturnDateForVisit(savedStateChange);
                                     callback3(eventSourcing.createStateChange('CREATE', library.Loan, null, loanEntityAttributes, randomOperator), undefined);
                                     },
                                     function (callback3, stateChange2) {
                                     stateChange2.save(function (err, savedStateChange2) {
                                     console.log(utils.logPreamble() + 'State change event saved ...OK [' + JSON.stringify(savedStateChange2) + ']');
                                     callback3('loan saved', undefined);
                                     });
                                     },
                                     function (callback3, args) {
                                     // Check index to see if it is the last one ...
                                     //var myVisitIndex = __.clone(visitIndex);
                                     console.log(utils.logPreamble() + 'Generating visits and loans: Done executing visit-generating function #' + visitIndex + ' of ' + numberOfVisitsToGenerate + ' ...');
                                     if (visitIndex >= numberOfVisitsToGenerate) {
                                     console.log('all-visit-statechangeevents-created !!');
                                     rq.then(curry(messageBus.publishAll, 'all-visit-statechangeevents-created'));
                                     }
                                     callback3(args, undefined);
                                     }
                                     //] // Not good enough!
                                     //])(rq.run) // OK
                                     ])(function (success, failure) { // Full control ...
                                     if (failure || !success) {
                                     //throw new Error('FAILURE :: ' + JSON.stringify(failure));
                                     console.warn(utils.logPreamble() + 'FAILURE: ' + JSON.stringify(failure));
                                     }
                                     console.log(utils.logPreamble() + 'Generating visits and loans: Loan-generating function executed successfully');
                                     })
                                     );
                                     //console.log(utils.logPreamble() + 'Generating visits and loans: Loan-generating function #' + bookLoanInVisitIndex + ' pushed to requestor sequence array ...');
                                     }
                                     console.log(utils.logPreamble() + 'Generating loans: Done! ' + (bookLoans.length - 1) + ' loan-generating functions pushed to requestor sequence array');
                                     callback2(savedStateChange, undefined);
                                     },
                                     */

                                    //rq.log(utils.logPreamble() + 'Generating visits and loans: Starting executing ' + (bookLoans.length - 1) + ' loan-generating functions ...'),
                                    //function (callback2, args2) {
                                    //    var y = 0;
                                    //    callback2(args2, undefined);
                                    //},

                                    sequence(bookLoanRequestors),

                                    // Nope, has to be done inside bookLoans sequence - its async!
                                    //emitConditionalVisitGenerationTermination(totalNumberOfBooks, numberOfVisitsToGenerate, visitIndex, bookLoans),

                                    //function (callback2, args2) {
                                    //    console.log(utils.logPreamble() + 'Generating visits and loans: Done executing visit-generating function #' + visitIndex + ' of ' + numberOfVisitsToGenerate + ' ...');
                                    //    if (visitIndex >= numberOfVisitsToGenerate) {
                                    //        console.log('!! all-visit-statechangeevents-created !!');
                                    //        rq.then(curry(messageBus.publishAll, 'all-visit-statechangeevents-created'));
                                    //    }
                                    //    callback2(args2, undefined);
                                    //},

                                    rq.log(utils.logPreamble() + 'Generating visits and loans: Done executing loan-generating function sequence'),
                                    clientPushMessageThrottlerRequestorFactory(numberOfServerPushEmits, startTime, numberOfVisitsToGenerate, visitIndex)
                                ])
                            );
                        }
                        callback(numberOfVisitsToGenerate, undefined);
                    },

                    rq.log(utils.logPreamble() + 'Generating visits and loans: Starting executing ${args} visit-generating functions ...'),
                    sequence(visitRequestors),
                    rq.log(utils.logPreamble() + 'Generating visits and loans: Done executing visit-and-loan-generating function sequence')//,

                    //// TODO: Premature invocation! Generating loans is probably not yet completed ...
                    //rq.log(utils.logPreamble() + 'Generating visits and loans: Hack, waiting a couple of seconds for loan state changes generation to complete ...'),
                    //rq.wait(10000),
                    //// => Move to after loan sequence (line 354) - check index to see if it is the last one ...
                    //rq.then(curry(messageBus.publishAll, 'all-visit-statechangeevents-created'))
                    //// /TODO
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(rq.run);
            //])(function (success, failure) {
            //    var i = 7;
            //});
        },


    /**
     * Admin API :: Purge the entire application store(s)
     * (by creating and sending (posting) a transient "clean" object/resource to the server)
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
     * (by creating and sending (posting) a transient "count" object/resource to the server)
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
            //eventStore_CountAllStateChanges = rqMongooseJsonStateChangeInvocation('count', countAllQuery),
            // TODO: 'library.Book' shouldn't really be referenced in this file
                eventStore_CountAllBooks = eventSourcing.count(library.Book, countAllQuery);

            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('POST', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),
                /*
                 sequence([
                 rq.if(cqrs.isEnabled),
                 applicationStores.countAllBooks,
                 utils.send200OkResponseWithArgumentAsBody(response)
                 ]),
                 */
                // Just a demo, not particular useful ...
                // TODO: Well! Remove it and see what happens ...
                /*
                 sequence([
                 eventStore_CountAllStateChanges,
                 rq.push,
                 rq.pick('count'),
                 rq.continueIf(lessThanOne),
                 rq.pop,
                 utils.send200OkResponseWithArgumentAsBody(response)
                 ]),
                 */
                /*
                 sequence([
                 // TODO: Could this push/pop thing be solved by initial values argument to requestor/requestor chains?
                 //rq.pop, // Cleaning: If reached this final sequence, the stacked value is not pop'ed - so just pop it and move on
                 //eventSourcing.count(library.Book, null),
                 eventStore_CountAllBooks,
                 //rq.return({ count: 23 }),
                 utils.send200OkResponseWithArgumentAsBody(response)
                 ]),
                 utils.send500InternalServerErrorResponse(response)
                 */

                // TODO: Application Store, manually: by using application store internals and invariants
                // TODO: Application Store: by regular counting
                sequence([
                    parallel([
                        // Sequence collections
                        sequence([
                            function (callback, args) {
                                //sequenceNumber.getSequenceNumber('books', function (err, seq) {
                                //    callback({ count: seq }, undefined);
                                //});
                                sequenceNumber.getNumberOfActiveSequenceNumbers('books', function (err, numberOfActiveSequenceNumbers) {
                                    callback({ count: numberOfActiveSequenceNumbers }, undefined);
                                });
                            }
                        ]),

                        // Event store, manually: by using event store internals and invariants
                        // Deactivated: sequenceNumber.getNumberOfUnusedSequenceNumbers() must be taken into account here if ...
                        //sequence([
                        //    function (callback, args) {
                        //        // Find all loans, where type is CREATE, sorted by timestamp descending - pick first one, get sequence number - voila!
                        //        eventSourcingModel.StateChange.find({
                        //            type: 'book',
                        //            method: 'CREATE'
                        //        }).sort('timestamp').exec(function (err, createdLoans) {
                        //            if (createdLoans.length < 1) {
                        //                return callback({ count: 0 }, undefined);
                        //            }
                        //            return callback({ count: createdLoans.pop().changes.sequenceNumber }, undefined);
                        //        });
                        //    }
                        //]),

                        // Event Store: by map-reducing by type and counting
                        eventSourcing.count(library.Book, null)
                    ]),
                    // Extra: Consistency check of retrieved results from different stores with different techniques
                    function (callback, args) {
                        //if (args[0].count === args[1].count && args[0].count === args[2].count) {
                        if (args[0].count === args[1].count) {
                            console.log(utils.logPreamble() + 'Consistent book results: ' + JSON.stringify(args[0]) + ' (2 calculations)');
                            callback(args[0], undefined);
                        } else {
                            console.error(utils.logPreamble() + 'Inconsistent book results:');
                            console.error('    ' + JSON.stringify(args[0]));
                            console.error('    ' + JSON.stringify(args[1]));
                            //console.error('    ' + JSON.stringify(args[2]));
                            callback(undefined, 'Inconsistent book results');
                        }
                    },
                    utils.send200OkResponseWithArgumentAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)

            ], 60000)(rq.handleTimeout(request, response));
        },


// TODO: Documentation ...
    _countAllVisits = exports.countAllVisits =
        function (request, response) {
            'use strict';
            var all = null;

            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('POST', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),

                // TODO: Application Store, manually: by using application store internals and invariants
                // TODO: Application Store: by regular counting
                sequence([
                    parallel([

                        // Sequence collections
                        sequence([
                            function (callback, args) {
                                // Using MongoDB API directly due to schema name as id tweak ...
                                sequenceNumber.getNumberOfActiveSequenceNumbers('visits', function (err, numberOfActiveSequenceNumbers) {
                                    callback({ count: numberOfActiveSequenceNumbers }, undefined);
                                });
                            }
                        ]),

                        // Event store, manually: by using event store internals and invariants
                        sequence([
                            function (callback, args) {
                                // Find all visits, where type is CREATE, sorted by timestamp descending - pick first one, get sequence number - voila!
                                eventSourcingModel.StateChange.find({
                                    type: 'visit',
                                    method: 'CREATE'
                                }).sort('timestamp').exec(function (err, createdVisits) {
                                    if (createdVisits.length < 1) {
                                        return callback({ count: 0 }, undefined);
                                    }
                                    return callback({ count: createdVisits.pop().changes.sequenceNumber }, undefined);
                                });
                            }
                        ]),

                        // Event Store: by map-reducing by type and counting
                        // TODO: 'library.Visit' shouldn't really be referenced in this file
                        eventSourcing.count(library.Visit, all)
                    ]),
                    // Extra: Consistency check of retrieved results from different stores with different techniques
                    function (callback, args) {
                        if (args[0].count === args[1].count && args[0].count === args[2].count) {
                            console.log(utils.logPreamble() + 'Consistent visit results: ' + JSON.stringify(args[0]) + ' (3 calculations)');
                            callback(args[0], undefined);
                        } else {
                            console.error(utils.logPreamble() + 'Inconsistent visit results:');
                            console.error('    ' + JSON.stringify(args[0]));
                            console.error('    ' + JSON.stringify(args[1]));
                            console.error('    ' + JSON.stringify(args[2]));
                            callback(undefined, 'Inconsistent visit results');
                        }
                    },
                    utils.send200OkResponseWithArgumentAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ], 60000)(rq.handleTimeout(request, response));
        },


// TODO: Documentation ...
    _countAllLoans = exports.countAllLoans =
        function (request, response) {
            'use strict';
            var all = null;

            firstSuccessfulOf([
                sequence([
                    rq.if(not(isHttpMethod('POST', request))),
                    rq.value('URI \'' + request.originalUrl + '\' supports POST requests only'),
                    utils.send405MethodNotAllowedResponseWithArgumentAsBody(response)
                ]),

                // TODO: Application Store, manually: by using application store internals and invariants
                // TODO: Application Store: by regular counting
                sequence([
                    parallel([

                        // Sequence collections
                        sequence([
                            function (callback, args) {
                                // Using MongoDB API directly due to schema name as id tweak ...
                                sequenceNumber.getNumberOfActiveSequenceNumbers('loans', function (err, numberOfActiveSequenceNumbers) {
                                    callback({ count: numberOfActiveSequenceNumbers }, undefined);
                                });
                            }
                        ]),

                        // Event store, manually: by using event store internals and invariants
                        sequence([
                            function (callback, args) {
                                // Find all loans, where type is CREATE, sorted by timestamp descending - pick first one, get sequence number - voila!
                                eventSourcingModel.StateChange.find({
                                    type: library.Loan.modelName,
                                    method: 'CREATE'
                                }).sort('timestamp').exec(function (err, createdLoans) {
                                    if (createdLoans.length < 1) {
                                        return callback({ count: 0 }, undefined);
                                    }
                                    return callback({ count: createdLoans.pop().changes.sequenceNumber }, undefined);
                                });
                            }
                        ]),

                        // Event Store: by map-reducing by type and counting
                        eventSourcing.count(library.Loan, all)
                    ]),
                    // Extra: Consistency check of retrieved results from different stores with different techniques
                    function (callback, args) {
                        if (args[0].count === args[1].count && args[0].count === args[2].count) {
                            console.log(utils.logPreamble() + 'Consistent loan results: ' + JSON.stringify(args[0]) + ' (3 calculations)');
                            callback(args[0], undefined);
                        } else {
                            console.error(utils.logPreamble() + 'Inconsistent loan results:');
                            console.error('    ' + JSON.stringify(args[0]));
                            console.error('    ' + JSON.stringify(args[1]));
                            console.error('    ' + JSON.stringify(args[2]));
                            callback(undefined, 'Inconsistent loan results');
                        }
                    },
                    utils.send200OkResponseWithArgumentAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ], 60000)(rq.handleTimeout(request, response));
        },


// TODO: Documentation ...
    _countLoansForBook = exports.countLoansForBook =
        function (request, response) {
            'use strict';
            var entityId = request.params.entityId;

            sequence([
                rq.log(utils.logPreamble() + 'Counting loans for book ' + entityId + ' ...'),
                eventSourcing.count(library.Loan, { target: entityId }),
                utils.send200OkResponseWithArgumentAsBody(response)
            ], 4000)(rq.handleTimeout(request, response));
        },


// TODO: Documentation ...
    _isBookOnLoan = exports.isBookOnLoan =
        function (request, response) {
            'use strict';

            // Not implemented:
            //throw new Error('Not yet implemented'); // => 500

            //response.sendStatus(501); // => 501

            //response.sendStatus(httpResponse['Not Implemented']); // => 501

            //sequence([
            //    utils.send501NotImplementedServerErrorResponse(response)
            //])(rq.run); // => 501

            //sequence([
            //    function (callback, args) {
            //        setTimeout(function () {
            //            callback('...', undefined);
            //        }, 3000);
            //    }
            //])(rq.run); // => Hangs forever ...

            //sequence([
            //    rq.notImplemented
            ////])(rq.run); // => Hangs forever ...
            //], 2000)(rq.handleTimeout(request, response)); // => 501


            // Fake:
            setTimeout(function () {
                //response.json({ isOnLoan: false });
                response.json({ isOnLoan: true });
            }, 1500);


            /*
             // Accurate:
             // TODO: Get all loans, check if one of the 'returnDate' is null
             // TODO: 500 Server Error if more than one is null !
             var entityId = request.params.entityId;

             sequence([
             rq.log(utils.logPreamble() + 'Checking if book (id=' + entityId + ') is on loan ...'),
             eventSourcing.find(library.Loan, { book: entityId }),
             function (callback, bookLoanArray) {
             var s = 9;
             callback(bookLoanArray, undefined);
             },
             rq.pick('value'),
             function (callback, bookLoans) {
             var s = 9;
             callback(bookLoans, undefined);
             }
             ], 4000)(rq.handleTimeout(request, response));
             */
        },


    /**
     * Library API :: Get a projection of books
     * (by creating and sending (posting) a transient "projection" object/resource to the server)
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
                    eventSourcing.projectBooks(library.Book, findQuery, sortQuery, skip, limit),
                    utils.send200OkResponseWithArgumentAsBody(response)
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(rq.run);
        },


    _projectLoans = exports.projectLoans =
        function (request, response) {
            'use strict';
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
                    function (callback, stateChange) {
                        sequenceNumber.incrementUnusedSequenceNumbers('books', function (err, numberOfUnusedSequenceNumbers) {
                            callback(stateChange, undefined);
                        });
                    },
                    utils.send201CreatedResponseWithArgumentAsBody(response),
                    rq.pick('entityId'),
                    rq.then(curry(messageBus.publishAll, 'book-removed'))
                ]),
                utils.send500InternalServerErrorResponse(response)
            ])(rq.run);
        };
