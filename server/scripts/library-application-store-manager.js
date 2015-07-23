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

    rq = require('RQ-essentials'),

    curry = require('./fun').curry,
    utils = require('./utils'),

    messageBus = require('./messaging'),
    eventSourcing = require('./mongoose.event-sourcing'),
    eventSourcingModel = require('./mongoose.event-sourcing.model'),
    mongooseEventSourcingMapreduce = require("./mongoose.event-sourcing.mapreduce"),

    app = require('./app.config'),
    mongoDbAppStore = require('./library-application-store.mongodb'),
    naiveInMemoryAppStore = require('./library-application-store.naive-inmemory'),
    cqrs = require('./cqrs-service-api'),
    library = require('./library-model.mongoose'),


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
    rqMongooseBookInvocation = curry(rq.mongoose, utils.doNotLog, library.Book),
    rqMongooseJsonBookInvocation = curry(rq.mongooseJson, utils.doNotLog, library.Book),
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
            ])(rq.run);
        },


    _removeAllBooks = exports.removeAllBooks =
        function (callback, args) {
            'use strict';
            sequence([
                parallel([
                    naiveInMemoryAppStore.reset,
                    mongoDbAppStore.reset
                ]),
                // TODO: This is a generic function, generify and extract => 'RQ-essentials.js'
                function (callback2, applicationStoreStatusCodes) {

                    // TODO: Move to http predicates somewhere
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
                    // TODO: More response codes, I guess ...

                    console.error(app.config.logPreamble() + 'Application Store Manager :: Remove all books failed! (Unknown status codes combinations returned from application stores');
                    callback(undefined, 'Application Store Manager :: Remove all books failed! (Unknown status codes combinations returned from application stores');
                }
            ])(rq.run);
        };


///////////////////////////////////////////////////////////////////////////////
// Register application subscriptions
///////////////////////////////////////////////////////////////////////////////

// Replay all Book state change events when new state changes have been created
// TODO: Consider doing keeping application stores in sync in a somewhat more incremental manner ...
messageBus.subscribe(['cqrs', 'all-book-statechangeevents-created', 'all-visit-statechangeevents-created', 'replay-all-events'], function (message) {
    'use strict';
    sequence([
        rq.log(app.config.logPreamble() + 'Application Store Manager :: \'cqrs\' | \'all-book-statechangeevents-created\' | \'all-visit-statechangeevents-created\' | \'replay-all-events\' :: subscription message received'),
        rq.continueIf(cqrs.isEnabled),
        mongooseEventSourcingMapreduce.find(library.Book),

        // TODO: Should be in parallel, like below - but crashes from time to time ...
        naiveInMemoryAppStore.replayAllStateChanges(library.Book, 'event-mapreduced'),
        mongoDbAppStore.replayAllStateChanges(library.Book, 'event-mapreduced')
    ])(rq.run);
});


messageBus.subscribe(['book-updated'], function (updatedBook) {
    'use strict';
    sequence([
        rq.log(app.config.logPreamble() + 'Application Store Manager :: \'book-updated\' :: subscription message received'),
        rq.continueIf(cqrs.isEnabled),
        rq.value(updatedBook),
        parallel([
            naiveInMemoryAppStore.updateBook,
            mongoDbAppStore.updateBook
        ])
    ])(rq.run);
});


messageBus.subscribe(['book-removed'], function (entityId) {
    'use strict';
    sequence([
        rq.log(app.config.logPreamble() + 'Application Store Manager :: \'book-removed\' :: subscription message received'),
        rq.continueIf(cqrs.isEnabled),
        rq.value(entityId),
        parallel([
            naiveInMemoryAppStore.removeBook,
            mongoDbAppStore.removeBook
        ])
    ])(rq.run);
});
