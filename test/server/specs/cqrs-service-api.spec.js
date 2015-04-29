/* global describe:false, it:false, beforeEach:false, afterEach:false */
/* jshint -W024, -W030 */

var sinon = require('sinon'),
    expect = require('chai').expect,
    proxyquire = require('proxyquire'),
    rq = require("rq-essentials"),

    serverPushStub = {},
    eventSourcingStub = {},

    cqrsService = proxyquire('../../../server/scripts/cqrs-service-api', {
        './mongoose.event-sourcing': eventSourcingStub,
        './server-socketio': serverPushStub
    });


describe('CQRS service API specification\'s', function () {
    'use strict';

    beforeEach(function () {
        cqrsService._setCqrsStatus(false);
    });

    afterEach(function () {
    });


    it('should exist', function () {
        expect(cqrsService).to.exist;
        expect(cqrsService).to.be.an('object');
    });


    it('should have CQRS flag, set to false by default', function () {
        expect(cqrsService.getCqrsStatus).to.exist;
        expect(cqrsService.getCqrsStatus).to.be.a('function');
        expect(cqrsService.getCqrsStatus()).to.be.false;
    });


    describe('status function', function () {

        it('should exist', function () {
            expect(cqrsService.status).to.exist;
        });


        it('should be a function', function () {
            expect(cqrsService.status).to.be.a('function');
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

            cqrsService.status(request, response);

            expect(responseSendStatusSpy.calledOnce).to.be.true;
            expect(responseSendStatusSpy.alwaysCalledWithExactly(405)).to.be.true;
        });


        it('should return nothing (standard REST)', function () {
            var request = {
                    method: 'GET'
                },
                response = {
                    status: function (statusCode) {
                        return {
                            send: rq.identity
                        };
                    }
                };

            expect(cqrsService.status(request, response)).to.be.undefined;
        });


        it('should send response status code 200 OK', function () {
            var request = {
                    method: 'GET'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    expect(statusCode).to.be.equal(200);
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    status: responseStatusSpy
                };

            cqrsService.status(request, response);

            expect(responseStatusSpy.calledOnce).to.be.true;
            expect(responseStatusSpy.alwaysCalledWithExactly(200)).to.be.true;
        });


        it('should send response body reflecting CQRS status flag, boolean type', function () {
            var request = {
                    method: 'GET'
                },
                responseSendSpy = sinon.spy(),
                response = {
                    status: sinon.spy(function (statusCode) {
                        return {
                            send: responseSendSpy
                        };
                    })
                };

            expect(cqrsService.getCqrsStatus()).to.be.false;

            cqrsService.status(request, response);

            expect(cqrsService.getCqrsStatus()).to.be.false;
            expect(responseSendSpy.calledOnce).to.be.true;
            expect(responseSendSpy.calledWithExactly(false)).to.be.true;

            cqrsService._setCqrsStatus(true);
            expect(cqrsService.getCqrsStatus()).to.be.true;

            cqrsService.status(request, response);

            expect(cqrsService.getCqrsStatus()).to.be.true;
            expect(responseSendSpy.calledTwice).to.be.true;
            expect(responseSendSpy.secondCall.calledWithExactly(true)).to.be.true;
        });


        it('should not emit any server push messages', function () {
            var request = {
                    method: 'GET'
                },
                response = {
                    status: sinon.spy(function (statusCode) {
                        return {
                            send: rq.identity
                        };
                    })
                };

            serverPushStub.serverPush.emit = sinon.stub();

            cqrsService.status(request, response);

            expect(serverPushStub.serverPush.emit.called).to.be.false;
        });
    });


    describe('toggle function', function () {

        it('should exist', function () {
            expect(cqrsService.toggle).to.exist;
        });


        it('should be a function', function () {
            expect(cqrsService.toggle).to.be.a('function');
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

            cqrsService.toggle(request, response);

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

            cqrsService._setCqrsStatus(true);

            expect(cqrsService.toggle(request, response)).to.be.undefined;
        });


        it('should send response status code 202 Accepted', function () {
            var request = {
                    method: 'POST'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    expect(statusCode).to.be.equal(202);
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    sendStatus: responseStatusSpy
                };

            cqrsService._setCqrsStatus(true);

            cqrsService.toggle(request, response);

            expect(responseStatusSpy.calledOnce).to.be.true;
            expect(responseStatusSpy.alwaysCalledWithExactly(202)).to.be.true;
        });


        it('should toggle CQRS status flag', function () {
            var request = {
                    method: 'POST'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    expect(statusCode).to.be.equal(202);
                    return {
                        send: rq.identity
                    };
                }),
                response = {
                    sendStatus: responseStatusSpy
                };

            expect(cqrsService.getCqrsStatus()).to.be.false;
            cqrsService._setCqrsStatus(true);
            expect(cqrsService.getCqrsStatus()).to.be.true;

            cqrsService.toggle(request, response);

            expect(cqrsService.getCqrsStatus()).to.be.false;
        });


        it('should emit \'cqrs\' server push messages containing the current CQRS status flag value', function () {
            var request = {
                    method: 'POST'
                },
                response = {
                    sendStatus: rq.identity
                };

            serverPushStub.serverPush.emit = sinon.stub();
            cqrsService._setCqrsStatus(true);

            cqrsService.toggle(request, response);

            expect(serverPushStub.serverPush.emit.calledOnce).to.be.true;
            expect(serverPushStub.serverPush.emit.alwaysCalledWith('cqrs', cqrsService.getCqrsStatus())).to.be.true;
        });


        it('should replay state changes when toggling CQRS status flag from false to true', function () {
            var request = {
                    method: 'POST'
                },
                response = {
                    sendStatus: rq.identity
                };

            eventSourcingStub.replayAllStateChanges = sinon.stub();

            cqrsService.toggle(request, response);

            expect(eventSourcingStub.replayAllStateChanges.calledOnce).is.true;
        });
    });
});
