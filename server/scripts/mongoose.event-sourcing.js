/* global JSON:false */
/* jshint -W106 */

var __ = require('underscore'),
    moment = require('moment'),

    RQ = require('async-rq'),
    sequence = RQ.sequence,
    firstSuccessfulOf = RQ.fallback,
    parallel = RQ.parallel,
    race = RQ.race,

    rq = require('RQ-essentials'),
    then = rq.then,
    cancel = rq.cancel,
    mongooseQueryInvocation = rq.mongooseQueryInvocation,

    utils = require('./utils.js'),

    sequenceNumber = require('./mongoose.sequence-number'),
    mongooseEventSourcingMapreduce = require('./mongoose.event-sourcing.mapreduce'),
    mongooseEventSourcingModels = require('./mongoose.event-sourcing.model'),

    logPreamble = function () {
        'use strict';
        return '[' + moment().format('YYYY-MM-DD HH:mm:ss') + '] Mongoose.EventSourcing :: ';
    },


    /**
     * @returns {Object} Shallow cloned version of given object with all properties prefixed with "value."
     * @private
     */
    _addMapReducePrefixTo = exports._addMapReducePrefixTo =
        function (obj) {
            'use strict';
            var result = {};
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    result['value.' + key] = obj[key];
                }
            }
            if (__.isEmpty(result)) {
                return null;
            }
            return result;
        },


    /**
     * @private
     */
    _buildObject = exports._buildObject =
        function (obj) {
            'use strict';
            if (obj.value) {
                obj.value._id = obj._id;
                return obj.value;
            }
            return null;
        },


// Generic Mongoose helper functions
    createUuid = exports.createUuid =
        function () {
            'use strict';
            return new mongooseEventSourcingModels.Uuid()._id;
        },


//////////////////////////////////////
// Private event sourcing functions
//////////////////////////////////////


//////////////////////////////////////
// Public event sourcing functions
//////////////////////////////////////

    /**
     * Creates a state change event.
     *
     * @param method CREATE, UPDATE, or DELETE
     * @param entityType Mongoose model type
     * @param entityId Entity id
     * @param changes the changes object
     * @param user the user issuing the change
     * @returns {StateChange} object
     * @private
     */
    _createStateChange = exports.createStateChange =
        function (method, entityType, entityId, changes, user) {
            'use strict';

            // Create state change event
            var change = new mongooseEventSourcingModels.StateChange();

            // Create state change event: Meta data
            change.user = user;
            change.timestamp = Date.now();
            change.method = method;
            change.type = entityType.modelName;
            change.entityId = change.method === 'CREATE' ? createUuid() : entityId;

            if (changes) {
                // Remove MongoDB/Mongoose id property "_id" if exists
                // Frameworks like Backbone need the id property present to do a PUT, and not a CREATE ...
                if (changes._id) {
                    delete changes._id;
                }
                // If a CREATE or an UPDATE, add the changes if given: the domain object changes a.k.a. "the diff"/"the delta"
                if (__.contains(['CREATE', 'UPDATE'], change.method)) {
                    change.changes = changes;
                }
            }

            //if (change.method === 'CREATE' && change.changes.sequenceNumber) {
            //console.log(logPreamble() + 'State change event created [method=' + change.method + ', type=' + change.type + ', seq=' + change.changes.seq + ', entityId=' + change.entityId + ']');
            //} else {
            //console.log(logPreamble() + 'State change event created [method=' + change.method + ', type=' + change.type + ', entityId=' + change.entityId + ']');
            //    console.log(logPreamble() + 'State change event created [' + JSON.stringify(change) + ']');
            //}

            return change;
        },


    /**
     * Creates new state change and saves it in the <em>event store</em>.
     *
     * @param method CREATE, UPDATE, or DELETE
     * @param entityType Mongoose model type
     * @param entityId Entity id
     * @param stateChanges the changes object
     * @param user the user issuing the change
     * @returns {Promise} StateChange object
     */
    _createAndSaveStateChangeRequestorFactory = exports.createAndSaveStateChange =
        function (method, entityType, entityId, stateChanges, user) {
            'use strict';
            return function requestor(callback, args) {
                _createStateChange(method, entityType, entityId, stateChanges, user)
                    .save(function (err, savedStateChange) {
                        //console.log(logPreamble() + 'State change event saved ...OK [entityId=' + savedStateChanges.entityId + ']');
                        console.log(logPreamble() + 'State change event saved ...OK [' + JSON.stringify(savedStateChange) + ']');
                        return callback(savedStateChange, undefined);
                    });
            };
        },


    /**
     * Requestor: Retrieves all state change events having given entity id.
     *
     * @param entityId the entity id
     */
    _getStateChangesByEntityId = exports.getStateChangesByEntityId =
        function (entityId) {
            'use strict';
            return function requestor(callback, args) {
                mongooseEventSourcingModels.StateChange
                    .find({ entityId: entityId })
                    .sort({ timestamp: 'asc' })
                    .exec(function (err, stateChanges) {
                        if (err) {
                            return callback(undefined, err);
                        }
                        return callback(stateChanges, undefined);
                    });
            };
        },


    /**
     * Rebuilds an entity by replaying all given state changes.
     */
    rebuildEntity = exports.rebuildEntity =
        function (EntityType, entityId) {
            'use strict';
            return function requestor(callback, stateChanges) {
                var entity = new EntityType({ _id: entityId });
                entity.set(mongooseEventSourcingMapreduce._reduce_replayStateChangeEvents(entityId, stateChanges));
                return callback(entity, undefined);
            };
        },


    /**
     * Counts all entities of given type and conditions.
     *
     * @param entityType Mongoose model type
     * @param conditions Mongoose Query condition object
     */
    count = exports.count =
        function (entityType, conditions) {
            'use strict';
            return function requestor(callback, args) {
                var mapReducePrefixedConditions = _addMapReducePrefixTo(conditions),
                    thenFilterResult = mongooseQueryInvocation('count', mapReducePrefixedConditions);

                return firstSuccessfulOf([
                    sequence([
                        mongooseEventSourcingMapreduce.find(entityType),

                        // Handling of failed Mongoose Queries
                        function (callback, mongooseQuery) {
                            if (!mongooseQuery || __.isEmpty(mongooseQuery)) {
                                //console.log(logPreamble() + 'Missing Mongoose Query - probably empty database, continuing ...');
                                var fakeMongooseQuery = {};
                                fakeMongooseQuery.count = function (conditions, mongooseCallback) {
                                    return mongooseCallback(undefined, 0);
                                };
                                callback(fakeMongooseQuery, undefined);
                            }
                            return callback(mongooseQuery, undefined);
                        },
                        // /Handling of failed Mongoose Queries

                        thenFilterResult,
                        then(callback)
                    ]),
                    cancel(callback, logPreamble() + 'Counting \'' + entityType.modelName + 's\' via map-reducing event store failed!')
                ])(rq.run);
            };
        },


    /**
     * Finds all entities of given type and conditions.
     *
     * @param entityType Mongoose model type
     * @param conditions Mongoose Query condition object
     */
    find = exports.find =
        function (entityType, conditions) {
            'use strict';
            return function requestor(callback, args) {
                var mapReducePrefixedConditions = _addMapReducePrefixTo(conditions),
                    thenFilterResult = mongooseQueryInvocation('find', mapReducePrefixedConditions);

                return firstSuccessfulOf([
                    sequence([
                        mongooseEventSourcingMapreduce.find(entityType),

                        // Handling of failed Mongoose Query
                        function (callback, mongooseQuery) {
                            if (!mongooseQuery || __.isEmpty(mongooseQuery)) {
                                console.log(logPreamble() + 'Missing Mongoose Query - probably empty database, continuing ...');
                                var fakeMongooseQuery = {};
                                fakeMongooseQuery.find = function (conditions, mongooseCallback) {
                                    return mongooseCallback(undefined, 0);
                                };
                                callback(fakeMongooseQuery, undefined);
                            }
                            return callback(mongooseQuery, undefined);
                        },
                        // /Handling of failed Mongoose Query

                        thenFilterResult,
                        //rq.pick('find'), // Wait with this ... Do as count function above
                        then(callback)
                    ]),
                    cancel(callback, logPreamble + 'Finding \'' + entityType.modelName + 's\' via map-reducing event store failed!')
                ])(rq.run);
            };
        },


    projectBooks = exports.projectBooks =
        function (entityType, projectionConditions, sortConditions, skipValue, limitValue) {
            'use strict';
            return function requestor(callback, args) {
                var mapReducePrefixedConditions = _addMapReducePrefixTo(projectionConditions),
                    sortParams = _addMapReducePrefixTo(sortConditions),

                    totalCountRequestor = function requestor(callback, args) {
                        //console.log(logPreamble() + 'totalCountRequestor');
                        return args.cursor
                            .count(function (err, totalMapReducedResultCount) {
                                if (err) {
                                    console.error(logPreamble() + err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                args.totalCount = totalMapReducedResultCount;
                                return callback(args, undefined);
                            });
                    },
                    countRequestor = function requestor(callback, args) {
                        //console.log(logPreamble() + 'countRequestor');
                        return args.cursor
                            .count(mapReducePrefixedConditions)
                            .exec(function (err, projectedResultCount) {
                                if (err) {
                                    console.error(logPreamble() + err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                args.count = projectedResultCount;
                                return callback(args, undefined);
                            });
                    },
                    entitiesRequestor = function requestor(callback, args) {
                        //console.log(logPreamble() + 'booksRequestor');
                        return args.cursor
                            .find(mapReducePrefixedConditions)
                            .sort(sortParams)
                            .skip(skipValue)
                            .limit(limitValue)
                            .exec(function (err, paginatedResult) {
                                if (err) {
                                    console.error(logPreamble() + err.name + ' :: ' + err.message);
                                    return callback(undefined, err);
                                }
                                args.books = paginatedResult.map(_buildObject);
                                return callback(args, undefined);
                            });
                    };

                return firstSuccessfulOf([
                    sequence([
                        mongooseEventSourcingMapreduce.find(entityType),

                        // TODO: Crashes ... for some strange reason
                        //       => Seems like the order of the requestors counts ...
                        //       => Probably the MongoDB/Mongoose cursor function returned should be rewritten into RQ requestors, they seem not to be concurrent.
                        /*
                         parallel([
                         totalCountRequestor,
                         countRequestor,
                         booksRequestor
                         ]),
                         function (callback2, results) {
                         callback(results, undefined);
                         return callback2(results, undefined);
                         }
                         */

                        // Workaround A: Build holder argument and pass it sequentially along ...
                        function (callback2, cursor) {
                            var result = { cursor: cursor, books: null, count: null, totalCount: null };

                            // Special treatment: empty cursor means empty database ...
                            if (Object.keys(cursor).length === 0) {
                                return callback(result, undefined);
                                // Nope, just stop further processing here
                                //return callback2(undefined, 'No \'' + entityType.modelName + 's\' entities found in database ...');
                                //return callback2(result, undefined);
                            }
                            return callback2(result, undefined);
                        },
                        totalCountRequestor,
                        countRequestor,
                        entitiesRequestor,

                        // Workaround B: Remove cursor from argument and return it!
                        function (callback2, args) {
                            delete args.cursor;
                            callback2(args, undefined);
                            return callback(args, undefined);
                        }
                    ]),
                    cancel(callback, logPreamble - 'Projecting \'' + entityType.modelName + 's\' via map-reducing event store failed!')
                ])(rq.run);
            };
        },


    /**
     * @see http://stackoverflow.com/questions/14644545/random-document-from-a-collection-in-mongoose
     */
    getRandom = exports.getRandom =
        function (entityType, upperBound) {
            'use strict';
            return function requestor(callback, args) {
                firstSuccessfulOf([
                    sequence([
                        mongooseEventSourcingMapreduce.find(entityType),
                        function (callback2, entities) {
                            var randomIndexBase = Math.floor(Math.random() * upperBound),
                                randomBookIndex = randomIndexBase;

                            // TODO: Activate this particular remedy? ...
                            //if (randomIndexBase >= count) {
                            //    randomBookIndex = count - 1;
                            //} else if (randomIndexBase < 0) {
                            //    randomBookIndex = 0;
                            //}

                            entities.findOne().skip(randomBookIndex).exec(function (err, entity) {
                                var randomBook;

                                callback2(entities, undefined);

                                // TODO: Resolve this frequent error!
                                if (err) {
                                    console.error(logPreamble() + err.message + ' [count=' + upperBound + ', randomBookIndex=' + randomBookIndex + ']');
                                    //callback2(entities, undefined);
                                    return callback(undefined, err.message);
                                }

                                if (!entity) {
                                    //console.error(logPreamble() + 'Audit.JS getRandom :: No random entity found [count=' + upperBound + ', randomBookIndex=' + randomBookIndex + ']');
                                    entities.findOne({ seq: randomBookIndex }, function (err, randomEntity) {
                                        //console.error(logPreamble() + 'Audit.JS getRandom :: No random entity found, (count=' + upperBound + ', randomBookIndex=' + randomBookIndex + ')');
                                        if (randomEntity) {
                                            //callback(undefined, 'Audit.JS getRandom :: No random entity found [count=' + upperBound + ', randomBookIndex=' + randomBookIndex + '] (A second query found an entity though ...)');
                                            console.warn(logPreamble() + 'getRandom: No random entity found [count=' + upperBound + ', randomBookIndex=' + randomBookIndex + '] (A second query found an entity though ...)');
                                            randomBook = randomEntity.value;
                                            randomBook._id = randomEntity._id;
                                            randomBook.entityId = randomEntity._id;

                                            //callback2(entities, undefined);
                                            return callback(randomBook, undefined);

                                        } else {
                                            //callback(undefined, 'Audit.JS getRandom :: No random entity found [count=' + upperBound + ', randomBookIndex=' + randomBookIndex + '] (A second query also gave NO entities ...)');
                                            console.warn(logPreamble() + 'getRandom: No random entity found [count=' + upperBound + ', randomBookIndex=' + randomBookIndex + '] (A second query also gave NO entities ...)');
                                            sequence([
                                                mongooseEventSourcingMapreduce.find(entityType),
                                                function (callback2, mapReducedEntityQuery) {
                                                    mapReducedEntityQuery.exec(function (err, entities2) {
                                                        if (entities2 && entities2.length > 0) {
                                                            console.warn(logPreamble() + 'getRandom: Using first available entity as "random" ...)');
                                                            var firstEntity = entities2.pop();
                                                            randomBook = firstEntity.value;
                                                            randomBook._id = firstEntity._id;
                                                            randomBook.entityId = firstEntity._id;

                                                            //callback2(entities, undefined);
                                                            return callback(randomBook, undefined);

                                                        } else {
                                                            console.warn(logPreamble() + 'getRandom: Once again, NO map-reduced entities found ...)');

                                                            //callback2(entities, undefined);
                                                            return callback(undefined, 'I give up!');

                                                            // TODO: Reuse a cached book from previous successful execution ...

                                                        }
                                                    });
                                                }
                                            ])(rq.run);
                                        }
                                    });

                                } else {
                                    randomBook = entity.value;
                                    randomBook._id = entity._id;
                                    randomBook.entityId = entity._id;

                                    //callback2(entities, undefined);
                                    return callback(randomBook, undefined);
                                }
                            });
                            return callback2(entities, undefined);
                        }
                    ]),
                    cancel(callback, logPreamble + 'Getting random \'' + entityType.modelName + ' via map-reducing event store failed!')
                ])(rq.run);
            };
        };
