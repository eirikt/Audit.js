/* global describe:false, it:false, before:false, after:false, beforeEach:false, afterEach:false, JSON:false */
/* jshint -W024, -W030, -W106 */

var sinon = require('sinon'),
    expect = require('chai').expect,
    httpResponse = require('statuses'),

    messageBus = require('../../../server/scripts/messaging'),

    rq = require('RQ-essentials'),

    proxyquire = require('proxyquire').noCallThru(),

    rqStub = { '@noCallThru': false },
    mongodbStub = {},
    utilsStub = { '@noCallThru': false },
    messageBusStub = { '@noCallThru': false },
    serverPushStub = { '@noCallThru': false },
    eventSourcingStub = { '@noCallThru': false },
    sequenceNumberStub = {},
    mongooseEventSourcingMapreduceStub = { '@noCallThru': false },
    mongooseEventSourcingModelsStub = { '@noCallThru': false },
    mongodbMapReduceStatisticsEmitterStub = { '@noCallThru': false },
    applicationStoresStub = { '@noCallThru': false },
    cqrsServiceStub = {},
    libraryModelStub = { '@noCallThru': false },

    libraryService = proxyquire('../../../server/scripts/library-service-api', {
        'RQ-essentials': rqStub,
        './mongodb.config': mongodbStub,
        './utils': utilsStub,
        './messaging': messageBusStub,
        './socketio.config': serverPushStub,
        './mongoose.event-sourcing': eventSourcingStub,
        './mongoose.sequence-number': sequenceNumberStub,
        './mongoose.event-sourcing.mapreduce': mongooseEventSourcingMapreduceStub,
        './mongoose.event-sourcing.model': mongooseEventSourcingModelsStub,
        './mongodb.mapreduce-emitter': mongodbMapReduceStatisticsEmitterStub,
        './library-application-store-manager': applicationStoresStub,
        './cqrs-service-api': cqrsServiceStub,
        './library-model.mongoose': libraryModelStub
    });


describe('Library service API specification\'s', function () {
    'use strict';

    var stateChange1 = {
            user: 'user',
            timestamp: Date.now(),
            method: 'CREATE',
            type: 'Book',
            entityId: '55542f4556a413fc0b7fa066',
            changes: {
                _id: '55542f4556a413fc0b7fa066',
                author: '?',
                title: 'In the Dust of ... something',
                tags: []
            }
        },
        stateChange2 = {
            user: 'user',
            timestamp: Date.now(),
            method: 'UPDATE',
            type: 'Book',
            entityId: '55542f4556a413fc0b7fa066',
            changes: {
                author: 'Eugene Thacker'
            }
        },
        stateChange3 = {
            user: 'user',
            timestamp: Date.now(),
            method: 'UPDATE',
            type: 'Book',
            entityId: '55542f4556a413fc0b7fa066',
            changes: {
                title: 'In the Dust of this Planet'
            }
        };


    it('should exist', function () {
        expect(libraryService).to.exist;
        expect(libraryService).to.be.an('object');
    });


    describe('\'generateBooks\' resource function', function () {

        it('should exist as a function', function () {
            expect(libraryService.generateBooks).to.exist;
            expect(libraryService.generateBooks).to.be.a('function');
        });


        it('should accept HTTP POST only', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'library/books/generate',
                    params: {}
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.be.equal(405);
                                expect(responseBody).to.be.equal('URI \'' + request.originalUrl + '\' supports POST requests only');

                                done();
                            }
                        };
                    }
                };

            libraryService.generateBooks(request, response);
        });


        it('should send response status code 400 Bad Request when missing HTTP parameter \'numberOfBooks\'', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'library/books/generate',
                    params: {}
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(400);
                                expect(responseBody).to.equal('Mandatory HTTP parameter \'numberOfBooks\' is missing');

                                done();
                            }
                        };
                    }
                };

            libraryService.generateBooks(request, response);
        });


        it('should send response status code 400 Bad Request when HTTP parameter \'numberOfBooks\' is not a number', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'library/books/generate',
                    params: { numberOfBooks: 'yo' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(400);
                                expect(responseBody).to.equal('Mandatory HTTP parameter \'numberOfBooks\' is not a number');

                                done();
                            }
                        };
                    }
                };

            libraryService.generateBooks(request, response);
        });


        // TODO: More ... ?
        /*
         it('should ...', function () {
         var request = {
         method: 'POST',
         originalUrl: 'library/books/generate',
         body: { numberOfBooks: -1 }
         },
         response = {
         status: function (responseStatusCode) {
         return {
         json: function (responseBody) {
         //expect(responseStatusCode).to.equal(202);
         }
         };
         }
         };

         libraryService.generateBooks(request, response);
         });
         */
    });


    describe('\'removeAllBooksFromCache\' resource function', function () {
        it('should exist', function () {
            expect(libraryService.removeAllBooksFromCache).to.exist;
        });


        it('should be a function', function () {
            expect(libraryService.removeAllBooksFromCache).to.be.a('function');
        });


        it('should accept HTTP POST only', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'library/books/clean',
                    params: {},
                    body: null
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.be.equal(405);
                                expect(responseBody).to.be.equal('URI \'' + request.originalUrl + '\' supports POST requests only');

                                done();
                            }
                        };
                    }
                };

            libraryService.removeAllBooksFromCache(request, response);
        });


        it('should send response status code 202 Accepted, when CQRS is disabled', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'library/books/clean'
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(202);
                                expect(responseBody).to.exist;
                                expect(responseBody).to.be.equal('URI \'library/books/clean\' posted when no application store in use');

                                done();
                            }
                        };
                    }
                };

            cqrsServiceStub.isDisabled = function () {
                return true;
            };

            libraryService.removeAllBooksFromCache(request, response);
        });


        it('should send response status code 205 Reset Content, when CQRS is enabled', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'library/books/clean'
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(205);
                                expect(responseBody).to.be.equal('Reset Content');

                                done();
                            }
                        };
                    }
                };

            cqrsServiceStub.isDisabled = function () {
                return false;
            };

            applicationStoresStub.removeAllBooks = function (callback, args) {
                callback(httpResponse['Reset Content'], undefined);
            };

            libraryService.removeAllBooksFromCache(request, response);
        });


        // TODO: Establish 'library-application-store-manager.spec.js'
        // TODO: Re-specify this in 'library-application-store-manager.spec.js'
        //it('should publish \'remove-all-books\' message, server-side only, when CQRS is enabled', function (done) {
        //    var request = {
        //            method: 'POST',
        //            originalUrl: 'library/books/clean'
        //       },
        //        response = {
        //            sendStatus: rq.identity
        //        };
        //    cqrsServiceStub.isDisabled = function () {
        //        return false;
        //    };
        //    messageBusStub.publishServerSide = sinon.spy(messageBus.publishServerSide);
        //    messageBus.subscribeOnce('remove-all-books', function () {
        //        expect(arguments.length).to.be.equal(0);
        //        expect(messageBusStub.publishServerSide.calledOnce).to.be.true;
        //        expect(messageBusStub.publishServerSide.getCall(0).args[0]).to.be.equal('remove-all-books');
        //        // TODO: Why does this not work? It is fixed in 'messaging.js' ...
        //        //expect(messageBusStub.publishServerSide.getCall(0).args.length).to.be.equal(1);
        //        done();
        //    });
        //    libraryService.removeAllBooksFromCache(request, response);
        //});
    });


    describe('\'updateBook\' resource function', function () {

        beforeEach(function () {
            cqrsServiceStub.isEnabled = function () {
                return false;
            };

            cqrsServiceStub.isDisabled = function () {
                return true;
            };

            eventSourcingStub.getStateChangesByEntityId = sinon.spy(function (entityId) {
                return function requestor(callback, args) {
                    var stateChanges = [];

                    stateChanges.push(stateChange1);
                    stateChanges.push(stateChange2);
                    stateChanges.push(stateChange3);

                    return callback(stateChanges, undefined);
                };
            });

            eventSourcingStub.createAndSaveStateChange = sinon.spy(function (method, entityType, entityId, changes, user) {
                return function requestor(callback, args) {
                    //console.log('eventSourcingStub.createAndSaveStateChange(' + method + ', ..., ' + entityId + ', ' + JSON.stringify(changes) + ')');
                    if (method === "UPDATE" && changes) {
                        // Remove MongoDB/Mongoose id property "_id" if exists
                        // Frameworks like Backbone need the id property present to do a PUT, and not a CREATE ...
                        if (changes._id) {
                            delete changes._id;
                        }
                    }
                    var savedChanges = {
                        entityId: entityId,
                        changes: changes
                    };
                    return callback(savedChanges, undefined);
                };
            });
        });


        it('should exist as a function', function () {
            expect(libraryService.updateBook).to.exist;
            expect(libraryService.updateBook).to.be.a('function');
        });


        it('should accept HTTP PUT only', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: {},
                    body: null
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.be.equal(405);
                                expect(responseBody).to.be.equal('URI \'library/books/55542f4556a413fc0b7fa066\' supports PUT requests only');

                                done();
                            }
                        };
                    }
                };

            libraryService.updateBook(request, response);
        });


        // TODO: Include it?
        //it('should return nothing (standard REST)');


        it('should send response status code 400 Bad Request when missing resource element \'entityId\'', function (done) {
            var request = {
                    method: 'PUT',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: {},
                    body: null
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(400);
                                expect(responseBody).to.equal('Mandatory resource element \'entityId\' is missing');

                                done();
                            }
                        };
                    }
                };

            libraryService.updateBook(request, response);
        });


        it('should send response status code 400 Bad Request when missing request body', function (done) {
            var request = {
                    method: 'PUT',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' },
                    body: null
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(400);
                                expect(responseBody).to.equal('Mandatory request body is missing');

                                done();
                            }
                        };
                    }
                };

            libraryService.updateBook(request, response);
        });


        it('should send response status code 400 Bad Request when request body is empty', function (done) {
            var request = {
                    method: 'PUT',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' },
                    body: {}
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(400);
                                expect(responseBody).to.equal('Mandatory request body is not valid');

                                done();
                            }
                        };
                    }
                };

            libraryService.updateBook(request, response);
        });


        it('should send response status code 404 Not Found when no entity is found based on resource element \'entityId\'', function (done) {
            var request = {
                    method: 'PUT',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' },
                    body: {
                        _id: '55542f4556a413fc0b7fa066',
                        author: 'Eugene Thacker',
                        title: 'In the Dust of this Planet'
                    }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(404);
                                expect(responseBody).to.equal('No entity with entityId=\'55542f4556a413fc0b7fa066\' found');

                                done();
                            }
                        };
                    }
                };

            eventSourcingStub.getStateChangesByEntityId = sinon.spy(function (entityId) {
                return function requestor(callback, args) {
                    return callback(undefined, undefined);
                };
            });

            libraryService.updateBook(request, response);
        });


        it('should remove id property from request body', function (done) {
            var requestBody = {
                    _id: '55542f4556a413fc0b7fa066',
                    title: 'In the Dust of this Planet'
                },
                request = {
                    method: 'PUT',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' },
                    body: requestBody
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: rq.identity
                        };
                    }
                };

            messageBusStub.publishAll = sinon.spy(messageBus.publishAll);

            messageBus.subscribeOnce('book-updated', function (updatedBook) {
                expect(eventSourcingStub.createAndSaveStateChange.calledOnce).to.be.true;

                var call = eventSourcingStub.createAndSaveStateChange.getCall(0);
                expect(call.args[0]).to.be.equal('UPDATE');
                expect(call.args[2]).to.be.equal('55542f4556a413fc0b7fa066');
                expect(call.args[3]._id).to.not.exist;
                expect(call.args[3].title).to.be.equal('In the Dust of this Planet');
                expect(call.args[4]).to.exist;

                done();
            });

            libraryService.updateBook(request, response);
        });


        it('should send response status code 201 Created', function (done) {
            var request = {
                    method: 'PUT',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' },
                    body: {
                        _id: '55542f4556a413fc0b7fa066',
                        author: 'Eugene Thacker',
                        title: 'In the Dust of this Planet'
                    }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(201);
                                expect(responseBody).to.exist;
                                expect(responseBody.entityId).to.be.equal('55542f4556a413fc0b7fa066');
                                expect(responseBody.changes._id).to.not.exist;
                                expect(responseBody.changes.author).to.be.equal('Eugene Thacker');
                                expect(responseBody.changes.title).to.be.equal('In the Dust of this Planet');

                                done();
                            }
                        };
                    }
                };

            libraryService.updateBook(request, response);
        });


        // TODO: ...
        //it('should increase the active sequence number count');


        it('should publish \'book-updated\' message', function (done) {
            var requestBody = {
                    _id: '55542f4556a413fc0b7fa066',
                    author: 'Eugene Thacker'
                },
                request = {
                    method: 'PUT',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' },
                    body: requestBody
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: rq.identity
                        };
                    }
                },
                recreatedMongooseIdObject = mongooseEventSourcingModelsStub.createMongooseIdObject(stateChange1.changes._id);

            messageBusStub.publishAll = sinon.spy(messageBus.publishAll);

            messageBus.subscribeOnce('book-updated', function (updatedBook) {
                // CQRS: false
                // TODO: Establish 'library-application-store-manager.spec.js'
                // TODO: Re-specify this in 'library-application-store-manager.spec.js'
                //expect(libraryModelStub.Book.update.called).is.false;

                expect(messageBusStub.publishAll.calledOnce).to.be.true;
                expect(messageBusStub.publishAll.getCall(0).args[0]).to.be.equal('book-updated');

                // "entityId" is metadata located in the state change object, and should not be included in the entity objects.
                // The id property in MongoDB/Mongoose is "_id"
                expect(updatedBook.entityId).to.be.undefined;

                // The id property in MongoDB/Mongoose is a Mongoose schema-based object
                expect(JSON.stringify(updatedBook._id)).to.be.equal(JSON.stringify(recreatedMongooseIdObject._id));

                // The "author" property is in fact being updated, and therefore included in the request body
                expect(updatedBook.author).to.be.equal(requestBody.author);

                // The "title" property is added when "replaying" all state changes for this entity, as is done for the "book-updated" event"
                expect(updatedBook.title).to.be.equal(stateChange3.changes.title);

                // The "tag" property is added when "replaying" all state changes for this entity, as is done for the "book-updated" event"
                // It is an array Mongoose schema-based objects, but empty
                expect(updatedBook.tags).to.exist;
                expect(updatedBook.tags.length).to.be.equal(0);

                done();
            });

            libraryService.updateBook(request, response);
        });
    });


    describe('\'deleteBook\' resource function', function () {

        beforeEach(function () {
            cqrsServiceStub.isEnabled = function () {
                return false;
            };

            cqrsServiceStub.isDisabled = function () {
                return true;
            };

            eventSourcingStub.getStateChangesByEntityId = sinon.spy(function (entityId) {
                return function requestor(callback, args) {
                    var stateChanges = [];

                    stateChanges.push(stateChange1);
                    stateChanges.push(stateChange2);
                    stateChanges.push(stateChange3);

                    return callback(stateChanges, undefined);
                };
            });
        });


        it('should exist as a function', function () {
            expect(libraryService.removeBook).to.exist;
            expect(libraryService.removeBook).to.be.a('function');
        });


        it('should accept HTTP DELETE only', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.be.equal(405);
                                expect(responseBody).to.be.equal('URI \'library/books/55542f4556a413fc0b7fa066\' supports DELETE requests only');

                                done();
                            }
                        };
                    }
                };

            libraryService.removeBook(request, response);
        });


        /*
         // TODO: Include it?
         it('should return nothing (standard REST)', function () {
         var request = {
         method: 'DELETE',
         originalUrl: 'library/books/55542f4556a413fc0b7fa066',
         params: { id: '55542f4556a413fc0b7fa066' }
         },
         response = {
         status: function (statusCode) {
         return {
         json: rq.identity
         };
         }
         };
         expect(libraryService.removeBook(request, response)).to.be.undefined;
         });
         */


        it('should send response status code 400 Bad Request when missing resource element \'entityId\'', function (done) {
            var request = {
                    method: 'DELETE',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: {}
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(400);
                                expect(responseBody).to.equal('Mandatory resource element \'entityId\' is missing');

                                done();
                            }
                        };
                    }
                };

            libraryService.removeBook(request, response);
        });


        it('should send response status code 404 Not Found when no entity is found based on resource element \'entityId\'', function (done) {
            var request = {
                    method: 'DELETE',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(404);
                                expect(responseBody).to.equal('No entity with entityId=55542f4556a413fc0b7fa066 found');

                                done();
                            }
                        };
                    }
                };

            eventSourcingStub.getStateChangesByEntityId = sinon.spy(function (entityId) {
                return function requestor(callback, args) {
                    return callback(undefined, undefined);
                };
            });

            libraryService.removeBook(request, response);
        });


        it('should send response status code 201 Created', function (done) {
            var request = {
                    method: 'DELETE',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(201);
                                expect(responseBody).to.exist;
                                expect(responseBody.entityId).to.exist;
                                expect(responseBody.entityId).to.be.equal('55542f4556a413fc0b7fa066');

                                done();
                            }
                        };
                    }
                };

            eventSourcingStub.createAndSaveStateChange = sinon.spy(function (method, entityType, entityId, changes, user) {
                return function requestor(callback, args) {
                    var savedChanges = {
                        entityId: entityId
                    };
                    return callback(savedChanges, undefined);
                };
            });

            sequenceNumberStub.incrementUnusedSequenceNumbers = function (schemaName, callback) {
                callback(null, 0);
            };

            libraryService.removeBook(request, response);
        });


        // TODO: ...
        //it('should decrease the active sequence number count');


        it('should publish \'book-removed\' message', function (done) {
            var request = {
                    method: 'DELETE',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: rq.identity
                        };
                    }
                };

            eventSourcingStub.createAndSaveStateChange = sinon.spy(function (method, entityType, entityId, changes, user) {
                return function requestor(callback, args) {
                    var savedChanges = {
                        entityId: entityId
                    };
                    return callback(savedChanges, undefined);
                };
            });

            sequenceNumberStub.incrementUnusedSequenceNumbers = function (schemaName, callback) {
                callback(null, 0);
            };

            messageBusStub.publishAll = sinon.spy(messageBus.publishAll);

            messageBus.subscribeOnce('book-removed', function (entityIdOfRemovedBook) {
                // CQRS: false
                // TODO: Establish 'library-application-store-manager.spec.js'
                // TODO: Re-specify this in 'library-application-store-manager.spec.js'
                //expect(libraryModelStub.Book.remove.called).is.false;

                expect(entityIdOfRemovedBook).to.be.equal(request.params.entityId);

                expect(messageBusStub.publishAll.calledOnce).to.be.true;
                expect(messageBusStub.publishAll.getCall(0).args.length).to.be.equal(2);
                expect(messageBusStub.publishAll.getCall(0).args[0]).to.be.equal('book-removed');
                expect(messageBusStub.publishAll.getCall(0).args[1]).to.be.equal(request.params.entityId);

                done();
            });

            libraryService.removeBook(request, response);
        });
    });
});
