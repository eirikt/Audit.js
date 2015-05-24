/* global JSON:false */
/* jshint -W024, -W106 */

///////////////////////////////////////////////////////////////////////////////
// Library application store manager
///////////////////////////////////////////////////////////////////////////////

var __ = require('underscore'),
    httpResponse = require('statuses'),
    httpResponseCode = httpResponse,

    RQ = require('async-rq'),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,

    rq = require('rq-essentials'),
    go = rq.execute,

    curry = require('./fun').curry,
    utils = require('./utils'),

    clientSidePublisher = require('./socketio.config').serverPush,
    messageBus = require('./messaging'),
    eventSourcing = require('./mongoose.event-sourcing'),
    eventSourcingModel = require('./mongoose.event-sourcing.model'),
    mongooseEventSourcingMapreduce = require("./mongoose.event-sourcing.mapreduce"),

    mongoDbAppStore = require('./library-application-store.mongodb'),
    naiveInMemoryAppStore = require('./library-application-store.naive-inmemory'),
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


///////////////////////////////////////////////////////////////////////////////
// Public API
///////////////////////////////////////////////////////////////////////////////

    _countAllBooks = exports.countAllBooks =
        function (callback, args) {
            'use strict';
            var countAllQuery = null,
                appStore_InMemory_CountAllBooks = naiveInMemoryAppStore.count(),
                appStore_MongoDb_CountAllBooks = rqMongooseJsonBookInvocation('count', countAllQuery);

            sequence([
                race([
                    // TODO: 'race' takes an array of requestors, why do I have to wrap these requestors as a 'sequence' of requestors to make this work??
                    //sequence([
                    //    function (callback, args) {
                    //        console.log('Fake application store :: Fake returning 8765 ...');
                    //        return callback({ count: 8765 }, undefined);
                    //    }
                    //]),
                    sequence([
                        appStore_InMemory_CountAllBooks
                    ]),
                    sequence([
                        appStore_MongoDb_CountAllBooks
                    ])
                ]),
                function (callback2, args) {
                    // TODO: Replace with 'rq.terminator' or something
                    callback2(args, undefined);
                    callback(args, undefined);
                }
            ])(go);
        },


    _removeAllBooks = exports.removeAllBooks =
        function (callback, args) {
            'use strict';
            //try {
            sequence([
                parallel([
                    naiveInMemoryAppStore.reset,
                    mongoDbAppStore.reset
                ]),
                // TODO: This is a generic function, generify and extract
                function (callback2, applicationStoreStatusCodes) {
                    var isResetContent = function (element, index, array) {
                            return element === httpResponseCode['Reset Content'];
                        },
                        isNotImplemented = function (element, index, array) {
                            return element === httpResponseCode['Not Implemented'];
                        };

                    callback2(applicationStoreStatusCodes, undefined);

                    if (applicationStoreStatusCodes.every(isNotImplemented)) {
                        return callback(undefined, httpResponse['Not Implemented']);
                    }
                    if (applicationStoreStatusCodes.some(isResetContent)) {
                        return callback(httpResponse['Reset Content'], undefined);
                    }

                    console.error('Application Store Manager :: Remove all books failed! (Unknown status codes combinations returned from application stores');
                    callback(undefined, 'Application Store Manager :: Remove all books failed! (Unknown status codes combinations returned from application stores');
                }
            ])(go);
            //} catch (e) {
            //    console.error(e);
            //    console.error(JSON.stringify(e));
            //    console.error(e.message);
            //    if (e.message.toLowerCase() === 'not a function') {
            //        return callback(undefined, 501);
            //    }
            //    return callback(undefined, 500);
            //}
        };


///////////////////////////////////////////////////////////////////////////////
// Register application subscriptions
///////////////////////////////////////////////////////////////////////////////

// Replay all Book state change events when new state changes have been created
// TODO: Consider doing keeping application stores in sync in a somewhat more incremental manner ...
messageBus.subscribe(['cqrs', 'all-statechangeevents-created', 'replay-all-events'], function (message) {
    'use strict';
    sequence([
        rq.do(function () {
            console.log('Application Store Manager :: \'cqrs\' | \'all-statechangeevents-created\' | \'replay-all-events\' :: subscription message received');
        }),
        rq.continueIf(cqrs.isEnabled),
        // TODO: Why do these replaying of event store has to be sequential and not parallel?
        mongooseEventSourcingMapreduce.find(library.Book),
        naiveInMemoryAppStore.replayAllStateChanges(library.Book, 'event-mapreduced'),
        mongoDbAppStore.replayAllStateChanges(library.Book, 'event-mapreduced')//,
    ])(go);
});


messageBus.subscribe(['book-updated'], function (updatedBook) {
    'use strict';
});


messageBus.subscribe(['book-removed'], function (entityId) {
    'use strict';
});


/*
 messageBus.subscribe(['remove-all-books'], function (message) {
 'use strict';
 sequence([
 rq.do(function () {
 console.log('Application Store Manager :: \'remove-all-books\' :: subscription message received');
 }),
 rq.continueIf(cqrs.isEnabled),
 //function (callback, args) {
 //    return callback(args, undefined);
 //},
 // TODO: Why do these replaying of event store has to be sequential and not parallel?
 //rq.then(function () {
 mongooseEventSourcingMapreduce.find(library.Book),
 //}),
 //function (callback, args) {
 //    return callback(args, undefined);
 //},
 //rq.then(function () {
 naiveInMemoryAppStore.replayAllStateChanges(library.Book, 'event-mapreduced'),
 //}),
 //rq.then(function () {
 mongoDbAppStore.replayAllStateChanges(library.Book, 'event-mapreduced')//,
 //})//,
 //function (callback, args) {
 //    return callback(args, undefined);
 //}
 //rq.then(function () {
 //    naiveInMemoryAppStore.replayAllStateChanges();
 //})
 //])(run);
 ])(go);
 });
 */
