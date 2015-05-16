/* global describe:false, it:false, beforeEach:false, afterEach:false, JSON:false */
/* jshint -W024, -W030 */

var sinon = require('sinon'),
    expect = require('chai').expect,

    rq = require('rq-essentials'),

    messenger = require('../../../server/scripts/messaging'),

    proxyquire = require('proxyquire').noCallThru(),

    rqStub = { '@noCallThru': false },
    mongodbStub = {},
    utilsStub = { '@noCallThru': false },
    messengerStub = { '@noCallThru': false },
    serverPushStub = { '@noCallThru': false },
    eventSourcingStub = {},
    sequenceNumberStub = {},
    mongooseEventSourcingMapreduceStub = {},
    mongooseEventSourcingModelsStub = {},
    mongodbMapReduceStatisticsEmitterStub = { '@noCallThru': false },
    cqrsServiceStub = {},
    libraryModelStub = { '@noCallThru': false },

    eventSourcingService = proxyquire('../../../server/scripts/eventsourcing-service-api', {
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


describe('Event Sourcing service API specification\'s', function () {
    'use strict';

    var stateChange1 = {
            user: 'user',
            timestamp: Date.now(),
            method: 'CREATE',
            type: 'Book',
            entityId: '42',
            changes: { prop1: 'prop1Value', prop2: 'prop2Value' }
        },
        stateChange2 = {
            user: 'user',
            timestamp: Date.now(),
            method: 'UPDATE',
            type: 'Book',
            entityId: '42',
            changes: { prop1: 'newProp1Value', prop2: 'newProp2Value' }
        },
        stateChange3 = {
            user: 'user',
            timestamp: Date.now(),
            method: 'DELETE',
            type: 'Book',
            entityId: '42'
        };

    beforeEach(function () {
        eventSourcingStub.getStateChangesByEntityId = sinon.spy(function (entityId) {
            return function requestor(callback, args) {
                var stateChanges = [];

                stateChanges.push(stateChange1);
                stateChanges.push(stateChange2);
                stateChanges.push(stateChange3);

                return callback(stateChanges, undefined);
            };
        });

        cqrsServiceStub.isNotActivated = function () {
            return false;
        };
    });


    afterEach(function () {
    });


    it('should exist', function () {
        expect(eventSourcingService).to.exist;
        expect(eventSourcingService).to.be.an('object');
    });


    describe('\'count\' (state changes) resource function', function () {

        it('should exist', function () {
            expect(eventSourcingService.count).to.exist;
        });


        it('should be a function', function () {
            expect(eventSourcingService.count).to.be.a('function');
        });


        it('should accept HTTP POST only', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'events/count'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        send: assert
                    };
                }),
                response = {
                    sendStatus: responseStatusSpy,
                    status: responseStatusSpy
                },
                assert = function (responseBody) {
                    expect(responseStatusSpy.calledOnce).to.be.true;
                    expect(responseStatusSpy.alwaysCalledWithExactly(405)).to.be.true;
                    expect(responseBody).to.be.equal('URI \'events/count\' supports POST requests only');

                    done();
                };

            rqStub.mongoose = sinon.spy(function (mongooseModel, mongooseModelFunction, conditions) {
                return rq.null;
            });

            eventSourcingService.count(request, response);
        });


        it('should return nothing (standard REST)', function () {
            var request = {
                    method: 'POST'
                },
                responseStatusSendSpy = sinon.spy(function (statusCode) {
                    expect(statusCode).to.be.equal(200);
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    sendStatus: responseStatusSendSpy,
                    status: responseStatusSendSpy
                };

            rqStub.mongoose = sinon.spy(function (mongooseModel, mongooseModelFunction, conditions) {
                return rq.null;
            });

            expect(eventSourcingService.count(request, response)).to.be.undefined;
        });


        it('should send response status code 200 OK', function (done) {
            var request = {
                    method: 'POST'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    //response.statusCode = statusCode;
                    return {
                        send: assert
                    };
                }),
                response = {
                    status: responseStatusSpy
                },
                assert = function () {
                    expect(responseStatusSpy.called).to.be.true;
                    //expect(response.statusCode).to.equal(200);
                    expect(responseStatusSpy.alwaysCalledWithExactly(200)).to.be.true;

                    done();
                };

            rqStub.mongoose = sinon.spy(function (mongooseModel, mongooseModelFunction, conditions) {
                return rq.value(0);
            });

            eventSourcingService.count(request, response);
        });


        it('should send state change counts as response body JSON, grouped by \'create\', \'update\', \'delete\', and total count', function (done) {
            var request = {
                    method: 'POST'
                },
                response = {
                    status: function () {
                        return {
                            send: assert
                        };
                    }
                },
                assert = function (responseBody) {
                    expect(responseBody).to.exist;

                    var marshalledJsonResponseBody = JSON.parse(JSON.stringify(responseBody));

                    expect(marshalledJsonResponseBody).to.be.an('object');
                    expect(Object.keys(marshalledJsonResponseBody).length).to.equal(4);

                    expect(marshalledJsonResponseBody.createCount).to.exist;
                    expect(marshalledJsonResponseBody.updateCount).to.exist;
                    expect(marshalledJsonResponseBody.deleteCount).to.exist;
                    expect(marshalledJsonResponseBody.totalCount).to.exist;

                    expect(marshalledJsonResponseBody.createCount).to.equal(0);
                    expect(marshalledJsonResponseBody.updateCount).to.equal(0);
                    expect(marshalledJsonResponseBody.deleteCount).to.equal(0);
                    expect(marshalledJsonResponseBody.totalCount).to.equal(0);

                    expect(rqStub.mongoose.calledThrice).to.be.true;
                    expect(rqStub.mongoose.getCall(0).args[1]).to.be.equal('count');
                    expect(rqStub.mongoose.getCall(0).args[2].method).to.be.equal('CREATE');
                    expect(rqStub.mongoose.getCall(1).args[1]).to.be.equal('count');
                    expect(rqStub.mongoose.getCall(1).args[2].method).to.be.equal('UPDATE');
                    expect(rqStub.mongoose.getCall(2).args[1]).to.be.equal('count');
                    expect(rqStub.mongoose.getCall(2).args[2].method).to.be.equal('DELETE');

                    done();
                };

            rqStub.mongoose = sinon.spy(function (mongooseModel, mongooseModelFunction, conditions) {
                return rq.value(0);
            });

            eventSourcingService.count(request, response);
        });


        it('should calculate total count', function (done) {
            var request = {
                    method: 'POST'
                },
                response = {
                    status: function () {
                        return {
                            send: assert
                        };
                    }
                },
                mongooseModelInvocationStub = function (mongooseModel, mongooseModelFunction, conditions) {
                    return rq.value(13);
                },
                assert = function (responseBody) {
                    expect(Object.keys(responseBody).length).to.equal(4);
                    expect(responseBody.totalCount).to.equal(3 * 13);
                    done();
                };

            rqStub.mongoose = mongooseModelInvocationStub;

            eventSourcingService.count(request, response);
        });
    });


    describe('get all state changes for a particular entity function', function () {

        it('should exist', function () {
            expect(eventSourcingService.events).to.exist;
        });


        it('should be a function', function () {
            expect(eventSourcingService.events).to.be.a('function');
        });


        it('should accept HTTP GET only', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: '/events',
                    params: { entityId: -1 }
                },
                response = {
                    status: function (statusCode) {
                        expect(statusCode).to.equal(405);
                        return {
                            send: function (responseBody) {
                                expect(responseBody).to.equal('URI \'' + request.originalUrl + '\' supports GET requests only');
                                done();
                            }
                        };
                    }
                };

            eventSourcingService.events(request, response);
        });


        it('should return nothing (standard REST)', function () {
            var request = {
                    method: 'GET',
                    params: { entityId: -1 }
                },
                response = {
                    status: function (statusCode) {
                        return {
                            send: rq.identity
                        };
                    }
                };

            expect(eventSourcingService.events(request, response)).to.be.undefined;
        });


        it('should send response status code 400 when missing mandatory parameter \'entityId\'', function (done) {
            var request = {
                    method: 'GET',
                    params: {}
                },
                response = {
                    status: function (statusCode) {
                        expect(statusCode).to.equal(400);
                        return {
                            send: function (responseBody) {
                                expect(responseBody).to.equal('Mandatory parameter \'entityId\' is missing');
                                done();
                            }
                        };
                    }
                };

            eventSourcingService.events(request, response);
        });


        it('should send response status code 200 OK', function (done) {
            var request = {
                    method: 'GET',
                    params: { entityId: 42 }
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        send: assert
                    };
                }),
                response = {
                    status: responseStatusSpy
                },
                assert = function () {
                    expect(responseStatusSpy.called).to.be.true;
                    expect(responseStatusSpy.alwaysCalledWithExactly(200)).to.be.true;

                    done();
                };

            eventSourcingService.events(request, response);
        });


        it('should send state change objects as JSON response body', function (done) {
            var request = {
                    method: 'GET',
                    params: { entityId: 42 }
                },
                response = {
                    status: function () {
                        return {
                            send: assert
                        };
                    }
                },
                assert = function (responseBody) {
                    expect(responseBody).to.exist;

                    var marshalledJsonResponseBody = JSON.parse(JSON.stringify(responseBody));
                    expect(marshalledJsonResponseBody).to.be.an('array');
                    expect(marshalledJsonResponseBody.length).to.equal(3);
                    expect(marshalledJsonResponseBody[0].method).to.equal('CREATE');
                    expect(marshalledJsonResponseBody[1].method).to.equal('UPDATE');
                    expect(marshalledJsonResponseBody[2].method).to.equal('DELETE');

                    done();
                };

            eventSourcingService.events(request, response);
        });
    });


    describe('replay all state change events for all entities', function () {

        it('should exist', function () {
            expect(eventSourcingService.replay).to.exist;
        });


        it('should be a function', function () {
            expect(eventSourcingService.replay).to.be.a('function');
        });


        it('should accept HTTP POST only', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: '/event/replay'
                },
                response = {
                    status: function (statusCode) {
                        expect(statusCode).to.equal(405);
                        return {
                            send: function (responseBody) {
                                expect(responseBody).to.equal('URI \'' + request.originalUrl + '\' supports POST requests only');
                                done();
                            }
                        };
                    }
                };

            eventSourcingService.replay(request, response);
        });


        it('should send response status code 403 Forbidden when application store is deactivated', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: '/event/replay'
                },
                response = {
                    status: function (statusCode) {
                        expect(statusCode).to.equal(403);
                        return {
                            send: function (responseBody) {
                                expect(responseBody).to.equal('URI \'' + request.originalUrl + '\' posted when no application store in use (CQRS not activated)');
                                done();
                            }
                        };
                    }
                };

            cqrsServiceStub.isNotActivated = function () {
                return true;
            };

            eventSourcingService.replay(request, response);
        });


        it('should send response status code 202 Accepted', function (done) {
            var request = {
                    method: 'POST'
                },
                response = {
                    sendStatus: function (statusCode) {
                        expect(statusCode).to.equal(202);
                        done();
                    }
                };

            eventSourcingService.replay(request, response);
        });


        // TODO: Nope, screw this, just use event messages and delegate!
        // => This is the responsibility of the Library app's MongoDB application store
        it('should always emit \'mapreducing-events\' and \'all-events-mapreduced\' server push messages', function (done) {
            var request = {
                    method: 'POST'
                },
                response = {
                    sendStatus: function (statusCode) {
                        expect(statusCode).to.equal(202);
                    }
                };

            mongooseEventSourcingMapreduceStub.find = function (entityType) {
                return function requestor(callback, args) {
                    var query = {
                        find: function (callback) {
                            var err,
                                cursor = [];
                            callback(err, cursor);
                        }
                    };
                    return callback(query, undefined);
                };
            };

            messengerStub.publishAll = sinon.spy(messenger.publishAll);

            messengerStub.subscribeOnce('all-events-replayed', function () {
                expect(messengerStub.publishAll.called).to.be.true;
                expect(messengerStub.publishAll.callCount).to.be.equal(4);

                var call1 = messengerStub.publishAll.getCall(0);
                expect(call1.args[0]).to.be.equal('mapreducing-events');

                var call2 = messengerStub.publishAll.getCall(1);
                expect(call2.args[0]).to.be.equal('all-events-mapreduced');

                var call3 = messengerStub.publishAll.getCall(2);
                expect(call3.args[0]).to.be.equal('replaying-events');

                var call4 = messengerStub.publishAll.getCall(3);
                expect(call4.args[0]).to.be.equal('all-events-replayed');

                done();
            });

            eventSourcingService.replay(request, response);
        });
    });
});
