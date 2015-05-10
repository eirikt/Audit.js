/* global describe:false, it:false, beforeEach:false, afterEach:false */
/* jshint -W024, -W030 */

var sinon = require('sinon'),
    expect = require('chai').expect,
    rq = require('rq-essentials'),

    proxyquire = require('proxyquire').noCallThru(),

    mongodbStub = {},
    utilsStub = {},
    eventSourcingStub = {},

    cqrsService = proxyquire('../../../server/scripts/cqrs-service-api', {
        './mongodb.config': mongodbStub,
        './utils': utilsStub,
        './mongoose.event-sourcing': eventSourcingStub
    });

describe('CQRS service API specification\'s', function () {
    'use strict';


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


        it('should accept HTTP GET only', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'cqrs/status'
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
                    expect(responseBody).to.be.equal('URI \'cqrs/status\' supports GET requests only');

                    done();
                };

            cqrsService.status(request, response);
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


        it('should send response status code 200 OK', function (done) {
            var request = {
                    method: 'GET'
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
                    expect(responseStatusSpy.alwaysCalledWithExactly(200)).to.be.true;

                    done();
                };

            cqrsService.status(request, response);
        });


        it('should send response body reflecting CQRS status flag, boolean type false', function (done) {
            var request = {
                    method: 'GET'
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
                    expect(responseBody).to.be.false;

                    done();
                };

            expect(cqrsService.getCqrsStatus()).to.be.false;
            expect(responseStatusSpy.called).to.be.false;

            cqrsService.status(request, response);
        });


        it('should send response body reflecting CQRS status flag, boolean type true', function (done) {
            var request = {
                    method: 'GET'
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
                    expect(responseBody).to.be.true;

                    done();
                };

            expect(cqrsService.getCqrsStatus()).to.be.false;
            expect(responseStatusSpy.called).to.be.false;

            cqrsService._setCqrsStatus(true);
            expect(cqrsService.getCqrsStatus()).to.be.true;

            cqrsService.status(request, response);
        });


        it('should not emit any server push messages', function () {
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

            utilsStub.publish = sinon.spy();

            cqrsService.status(request, response);

            expect(utilsStub.publish.called).to.be.false;
        });
    });


    describe('toggle function', function () {

        it('should exist', function () {
            expect(cqrsService.toggle).to.exist;
        });


        it('should be a function', function () {
            expect(cqrsService.toggle).to.be.a('function');
        });


        it('should accept HTTP GET only', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'cqrs/toggle'
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
                    expect(responseBody).to.be.equal('URI \'cqrs/toggle\' supports POST requests only');

                    done();
                };

            cqrsService.toggle(request, response);
        });


        it('should return nothing (standard REST)', function () {
            var request = {
                    method: 'POST',
                    originalUrl: 'cqrs/toggle'
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


        it('should send response status code 200 OK', function (done) {
            var request = {
                    method: 'POST'
                },
                response = {
                    sendStatus: function (statusCode) {
                        expect(statusCode).to.be.equal(200);
                        done();
                    }
                };

            utilsStub.publish = sinon.spy();

            cqrsService._setCqrsStatus(true);

            cqrsService.toggle(request, response);
        });


        it('should toggle CQRS status flag', function (done) {
            var request = {
                    method: 'POST'
                },
                response = {
                    sendStatus: function (statusCode) {
                        expect(cqrsService.getCqrsStatus()).to.be.false;
                        done();
                    }
                };

            utilsStub.publish = sinon.spy();

            expect(cqrsService.getCqrsStatus()).to.be.false;
            cqrsService._setCqrsStatus(true);
            expect(cqrsService.getCqrsStatus()).to.be.true;

            cqrsService.toggle(request, response);
        });


        // TODO: Emit message BEFORE or AFTER response??
        it('should publish \'cqrs\' event containing the current CQRS status boolean flag value', function () {
            var request = {
                    method: 'POST'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    expect(cqrsService.getCqrsStatus()).to.be.false;
                    expect(utilsStub.publish.calledOnce).to.be.true;
                    expect(utilsStub.publish.alwaysCalledWith('cqrs', cqrsService.getCqrsStatus())).to.be.true;
                }),
                response = {
                    sendStatus: responseStatusSpy,
                    status: responseStatusSpy
                };

            utilsStub.publish = sinon.spy();

            cqrsService._setCqrsStatus(true);

            cqrsService.toggle(request, response);
        });


        // Nope, set a an event listener, listening for 'cqrs'=true => with action replay all state change events
        it('should replay state changes when toggling CQRS status flag from false to true');
    });
});
