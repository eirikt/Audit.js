/* global describe:false, it:false, before:false, after:false, beforeEach:false, afterEach:false, JSON:false */
/* jshint -W024, -W030, -W106 */

var sinon = require('sinon'),
    expect = require('chai').expect,

    messenger = require('../../../server/scripts/messaging'),

    rq = require('rq-essentials'),

    proxyquire = require('proxyquire').noCallThru(),

    rqStub = { '@noCallThru': false },
    mongodbStub = {},
    utilsStub = { '@noCallThru': false },
    messengerStub = { '@noCallThru': false },
    serverPushStub = { '@noCallThru': false },
    eventSourcingStub = { '@noCallThru': false },
    sequenceNumberStub = {},
    mongooseEventSourcingMapreduceStub = { '@noCallThru': false },
    mongooseEventSourcingModelsStub = { '@noCallThru': false },
    mongodbMapReduceStatisticsEmitterStub = { '@noCallThru': false },
    cqrsServiceStub = {},
    libraryModelStub = { '@noCallThru': false },

    libraryService = proxyquire('../../../server/scripts/library-service-api', {
        'rq-essentials': rqStub,
        './mongodb.config': mongodbStub,
        './utils': utilsStub,
        './messaging': messengerStub,
        './socketio.config': serverPushStub,
        './mongoose.event-sourcing': eventSourcingStub,
        './mongoose.sequence-number': sequenceNumberStub,
        './mongoose.event-sourcing.mapreduce': mongooseEventSourcingMapreduceStub,
        './mongoose.event-sourcing.model': mongooseEventSourcingModelsStub,
        './mongodb.mapreduce-emitter': mongodbMapReduceStatisticsEmitterStub,
        './cqrs-service-api': cqrsServiceStub,
        './library-model': libraryModelStub
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
                keywords: []
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
        },

        recreatedMongooseIdObject = null;


    before(function () {
        recreatedMongooseIdObject = mongooseEventSourcingModelsStub.createMongooseIdObject(stateChange1.changes._id);
    });


    beforeEach(function () {
        messenger.resetMessenger();

        cqrsServiceStub.isCqrsActivated = function () {
            return false;
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
                console.log('eventSourcingStub.createAndSaveStateChange(' + method + ', ..., ' + entityId + ', ' + JSON.stringify(changes) + ')');
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


    afterEach(function () {
    });


    it('should exist', function () {
        expect(libraryService).to.exist;
        expect(libraryService).to.be.an('object');
    });


    describe('\'updateBook\' resource function', function () {

        it('should exist', function () {
            expect(libraryService.updateBook).to.exist;
        });


        it('should be a function', function () {
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
                            send: function (responseBody) {
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
                            send: function (responseBody) {
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
                            send: function (responseBody) {
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
                            send: function (responseBody) {
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
                            send: function (responseBody) {
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
                            send: rq.identity
                        };
                    }
                };

            messengerStub.publish = sinon.spy(messenger.publish);

            messenger.subscribeOnce('book-updated', function (updatedBook) {
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
                            send: function (responseBody) {
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

            // TODO: Should not be necessary - but needed for 'should update application store if applicable, and when completed, publish \'book-updated\' message' spec below to work ...
            cqrsServiceStub.isCqrsActivated = function () {
                return true;
            };

            libraryService.updateBook(request, response);
        });


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
                            send: rq.identity
                        };
                    }
                };

            // Update application store
            libraryModelStub.Book.update = sinon.spy(function (callback, stateChange) {
                return callback(stateChange, undefined);
            });

            messengerStub.publishAll = sinon.spy(messenger.publishAll);

            messenger.subscribeOnce('book-updated', function (updatedBook) {
                // CQRS: false
                expect(libraryModelStub.Book.update.called).is.false;

                expect(messengerStub.publishAll.calledOnce).to.be.true;
                expect(messengerStub.publishAll.getCall(0).args[0]).to.be.equal('book-updated');

                // "entityId" is metadata located in the state change object, and should not be included in the entity objects.
                // The id property in MongoDB/Mongoose is "_id"
                expect(updatedBook.entityId).to.be.undefined;

                // The id property in MongoDB/Mongoose is a Mongoose schema-based object
                expect(JSON.stringify(updatedBook._id)).to.be.equal(JSON.stringify(recreatedMongooseIdObject._id));

                // The "author" property is in fact being updated, and therefore included in the request body
                expect(updatedBook.author).to.be.equal(requestBody.author);

                // The "title" property is added when "replaying" all state changes for this entity, as is done for the "book-updated" event"
                expect(updatedBook.title).to.be.equal(stateChange3.changes.title);

                // The "keyword" property is added when "replaying" all state changes for this entity, as is done for the "book-updated" event"
                // It is an array Mongoose schema-based objects, but empty
                expect(updatedBook.keywords).to.exist;
                expect(updatedBook.keywords.length).to.be.equal(0);

                done();
            });

            libraryService.updateBook(request, response);
        });


        it('should update application store if applicable, and when completed, publish \'book-updated\' message', function (done) {
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
                            send: rq.identity
                        };
                    }
                };

            cqrsServiceStub.isCqrsActivated = function () {
                return true;
            };

            // Updating application store
            libraryModelStub.Book.update = sinon.spy(function (callback, stateChange) {
                return callback(stateChange, undefined);
            });

            messengerStub.publishAll = sinon.spy(messenger.publishAll);

            messenger.subscribeOnce('book-updated', function (updatedBook) {
                // CQRS: true
                expect(libraryModelStub.Book.update.calledOnce).is.true;

                expect(messengerStub.publishAll.calledOnce).to.be.true;
                expect(messengerStub.publishAll.getCall(0).args[0]).to.be.equal('book-updated');

                // "entityId" is metadata located in the state change object, and should not be included in the entity objects.
                // The id property in MongoDB/Mongoose is "_id"
                expect(updatedBook.entityId).to.be.undefined;

                // The id property in MongoDB/Mongoose is a Mongoose schema-based object
                expect(JSON.stringify(updatedBook._id)).to.be.equal(JSON.stringify(recreatedMongooseIdObject._id));

                // The "author" property is added when "replaying" all state changes for this entity, as is done for the "book-updated" event"
                expect(updatedBook.author).to.be.equal(stateChange2.changes.author);

                // The "title" property is in fact being updated, and therefore included in the request body
                expect(updatedBook.title).to.be.equal(requestBody.title);

                // The "keyword" property is added when "replaying" all state changes for this entity, as is done for the "book-updated" event"
                // It is an array Mongoose schema-based objects, but empty
                expect(updatedBook.keywords).to.exist;
                expect(updatedBook.keywords.length).to.be.equal(0);

                done();
            });

            libraryService.updateBook(request, response);
        });
    });


    describe('\'deleteBook\' resource function', function () {
        it('should exist', function () {
            expect(libraryService.removeBook).to.exist;
        });


        it('should be a function', function () {
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
                            send: function (responseBody) {
                                expect(responseStatusCode).to.be.equal(405);
                                expect(responseBody).to.be.equal('URI \'library/books/55542f4556a413fc0b7fa066\' supports DELETE requests only');

                                done();
                            }
                        };
                    }
                };

            libraryService.removeBook(request, response);
        });


        // TODO: Include it?
        /*
         it('should return nothing (standard REST)', function () {
         var request = {
         method: 'DELETE',
         originalUrl: 'library/books/55542f4556a413fc0b7fa066',
         params: { id: '55542f4556a413fc0b7fa066' }
         },
         response = {
         status: function (statusCode) {
         return {
         send: rq.identity
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
                            send: function (responseBody) {
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
                            send: function (responseBody) {
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
                            send: function (responseBody) {
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

            libraryService.removeBook(request, response);
        });


        it('should publish \'book-removed\' message', function (done) {
            var request = {
                    method: 'DELETE',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066',
                    params: { entityId: '55542f4556a413fc0b7fa066' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            send: rq.identity
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

            // Updating application store
            //libraryModelStub.Book.remove = sinon.spy(function (callback, stateChange) {
            //    return callback(stateChange, undefined);
            //});

            messengerStub.publishAll = sinon.spy(messenger.publishAll);

            messenger.subscribeOnce('book-removed', function (entityIdOfRemovedBook) {
                // CQRS: false
                //expect(libraryModelStub.Book.remove.called).is.false;

                expect(entityIdOfRemovedBook).to.be.equal(request.params.entityId);

                expect(messengerStub.publishAll.calledOnce).to.be.true;
                expect(messengerStub.publishAll.getCall(0).args.length).to.be.equal(2);
                expect(messengerStub.publishAll.getCall(0).args[0]).to.be.equal('book-removed');
                expect(messengerStub.publishAll.getCall(0).args[1]).to.be.equal(request.params.entityId);

                done();
            });

            libraryService.removeBook(request, response);
        });


        /* Nope, screw this, just use event messages and delegate!
         it('should update application store if applicable, and when completed, publish \'book-deleted\' message', function (done) {
         var request = {
         method: 'DELETE',
         originalUrl: 'library/books/55542f4556a413fc0b7fa066',
         params: { entityId: '55542f4556a413fc0b7fa066' }
         },
         response = {
         status: function (responseStatusCode) {
         return {
         send: rq.identity
         };
         }
         };

         cqrsServiceStub.isCqrsActivated = function () {
         return true;
         };

         eventSourcingStub.createAndSaveStateChange = sinon.spy(function (method, entityType, entityId, changes, user) {
         return function requestor(callback, args) {
         var savedChanges = {
         entityId: entityId
         };
         return callback(savedChanges, undefined);
         };
         });

         // Updating application store
         libraryModelStub.Book.remove = sinon.spy(function (callback, stateChange) {
         return callback(stateChange, undefined);
         });

         messengerStub.publish = sinon.spy(messenger.publish);

         messenger.subscribeOnce('book-removed', function (entityIdOfRemovedBook) {
         // CQRS: true
         // TODO: Fix! Nope, screw this, just use event messages and delegate!
         //expect(libraryModelStub.Book.remove.calledOnce).is.true;

         expect(messengerStub.publish.calledOnce).to.be.true;
         expect(messengerStub.publish.getCall(0).args.length).to.be.equal(1);
         expect(messengerStub.publish.getCall(0).args[0]).to.be.equal('book-removed');
         expect(entityIdOfRemovedBook).to.be.equal(request.params.entityId);

         done();
         });

         libraryService.removeBook(request, response);
         });
         */
    });
});
