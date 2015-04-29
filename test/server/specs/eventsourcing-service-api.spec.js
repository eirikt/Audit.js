/* global describe:false, it:false, beforeEach:false, afterEach:false, JSON:false */
/* jshint -W024, -W030 */

var sinon = require('sinon'),
    expect = require('chai').expect,
    proxyquire = require('proxyquire'),
    rq = require("rq-essentials"),

    rqStub = {},

    eventSourcingService = proxyquire('../../../server/scripts/eventsourcing-service-api', {
        'rq-essentials': rqStub
    });


describe('Event Sourcing service API specification\'s', function () {
    'use strict';

    //beforeEach(function () {
    //    console.log('status function.beforeEach');
    //    //cqrsService._setCqrsStatus(false);
    //});

    //afterEach(function () {
    //    console.log('status function.afterEach');
    //});


    it('should exist', function () {
        expect(eventSourcingService).to.exist;
        expect(eventSourcingService).to.be.an('object');
    });


    describe('count (state changes) function', function () {

        it('should exist', function () {
            expect(eventSourcingService.count).to.exist;
        });


        it('should be a function', function () {
            expect(eventSourcingService.count).to.be.a('function');
        });


        it('should only accept HTTP POST', function () {
            var request = {
                    method: 'GET'
                },
                responseStatusSendSpy = sinon.spy(function (statusCode) {
                    expect(statusCode).to.be.equal(405);
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    sendStatus: responseStatusSendSpy,
                    status: responseStatusSendSpy
                };

            eventSourcingService.count(request, response);

            expect(responseStatusSendSpy.calledOnce).to.be.true;
            expect(responseStatusSendSpy.alwaysCalledWithExactly(405)).to.be.true;
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

            expect(eventSourcingService.count(request, response)).to.be.undefined;
        });


        it('should send response status code 200 OK', function (done) {
            var request = {
                    method: 'POST'
                },
                responseStatusSpy = sinon.spy(function (/*statusCode*/) {
                    //response.statusCode = statusCode;
                    return {
                        send: function () {
                            assert();
                        }
                    };
                }),
                response = {
                    status: responseStatusSpy
                },
                mongooseModelInvocationStub = function (/*mongooseModel, mongooseModelFunction, conditions*/) {
                    return rq.value(0);
                },
                assert = function () {
                    expect(responseStatusSpy.called).to.be.true;
                    //expect(response.statusCode).to.equal(200);
                    expect(responseStatusSpy.alwaysCalledWithExactly(200)).to.be.true;

                    done();
                };

            rqStub.mongoose = mongooseModelInvocationStub;

            eventSourcingService.count(request, response);
        });


        it('should send state change counts, grouped by \'create\', \'update\', \'delete\', and total count', function (done) {
            var request = {
                    method: 'POST'
                },
                response = {
                    status: function () {
                        return {
                            send: function (responseBody) {
                                assert(responseBody);
                            }
                        };
                    }
                },
                mongooseModelInvocationStub = function (/*mongooseModel, mongooseModelFunction, conditions*/) {
                    return rq.value(0);
                },
                assert = function (responseBody) {
                    expect(responseBody).to.exist;
                    expect(responseBody).to.be.an('object');
                    expect(Object.keys(responseBody).length).to.equal(4);

                    var properJsonResponseBody = JSON.parse(JSON.stringify(responseBody));

                    expect(properJsonResponseBody.createCount).to.exist;
                    expect(properJsonResponseBody.updateCount).to.exist;
                    expect(properJsonResponseBody.deleteCount).to.exist;
                    expect(properJsonResponseBody.totalCount).to.exist;

                    expect(properJsonResponseBody.createCount).to.equal(0);
                    expect(properJsonResponseBody.updateCount).to.equal(0);
                    expect(properJsonResponseBody.deleteCount).to.equal(0);
                    expect(properJsonResponseBody.totalCount).to.equal(0);
                    done();
                };

            rqStub.mongoose = mongooseModelInvocationStub;

            eventSourcingService.count(request, response);
        });


        it('should calculate total count', function (done) {
            var request = {
                    method: 'POST'
                },
                response = {
                    status: function () {
                        return {
                            send: function (responseBody) {
                                assert(responseBody);
                            }
                        };
                    }
                },
                mongooseModelInvocationStub = function (/*mongooseModel, mongooseModelFunction, conditions*/) {
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


        // TODO:
        it('should return response code 500 Internal Server Error when failing');
    });


    describe('get all state changes for a particular entity function', function () {

        it('should exist', function () {
            expect(eventSourcingService.events).to.exist;
        });


        it('should be a function', function () {
            expect(eventSourcingService.events).to.be.a('function');
        });


        it('should only accept HTTP GET', function () {
            var request = {
                    method: 'POST'
                },
                responseSendStatusSpy = sinon.spy(function (statusCode) {
                    expect(statusCode).to.be.equal(405);
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    sendStatus: responseSendStatusSpy
                };

            eventSourcingService.events(request, response);

            expect(responseSendStatusSpy.calledOnce).to.be.true;
            expect(responseSendStatusSpy.alwaysCalledWithExactly(405)).to.be.true;
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


        it('should send response status code 400 when missing mandatory parameter \'entityId\'', function () {
            var request = {
                    method: 'GET',
                    params: {}
                },
                responseSendStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    sendStatus: responseSendStatusSpy
                };

            eventSourcingService.events(request, response);

            expect(responseSendStatusSpy.calledOnce).to.be.true;
            expect(responseSendStatusSpy.alwaysCalledWithExactly(400)).to.be.true;
        });


        it('should send response status code 200 OK', function () {
            var request = {
                    method: 'GET',
                    params: { entityId: 42 }
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    status: responseStatusSpy
                };

            eventSourcingService.events(request, response);

            expect(responseStatusSpy.calledOnce).to.be.true;
            expect(responseStatusSpy.alwaysCalledWithExactly(200)).to.be.true;
        });


        // TODO: Complete it ...
        it('should return response code 500 Internal Server Error when failing');
    });


    describe('replay all state change events for all entities', function () {

        it('should exist', function () {
            expect(eventSourcingService.replay).to.exist;
        });


        it('should be a function', function () {
            expect(eventSourcingService.replay).to.be.a('function');
        });


        it('should only accept HTTP POST', function () {
            var request = {
                    method: 'GET'
                },
                responseSendStatusSpy = sinon.spy(function (statusCode) {
                    expect(statusCode).to.be.equal(405);
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    sendStatus: responseSendStatusSpy
                };

            eventSourcingService.replay(request, response);

            expect(responseSendStatusSpy.calledOnce).to.be.true;
            expect(responseSendStatusSpy.alwaysCalledWithExactly(405)).to.be.true;
        });


        it('should return nothing (standard REST)', function () {
            var request = {
                    method: 'POST'
                },
                response = {
                    sendStatus: function (statusCode) {
                        return {
                            send: rq.identity
                        };
                    }
                };

            expect(eventSourcingService.replay(request, response)).to.be.undefined;
        });


        it('should send response status code 200 OK', function () {
            var request = {
                    method: 'POST'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    sendStatus: responseStatusSpy
                };

            eventSourcingService.replay(request, response);

            expect(responseStatusSpy.calledOnce).to.be.true;
            expect(responseStatusSpy.alwaysCalledWithExactly(200)).to.be.true;
        });


        // TODO: Complete it ...
        it('should return response code 500 Internal Server Error when failing');
        //it('...');
    });
});
