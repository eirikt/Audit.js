/* global describe:false, it:false, before:false, after:false, beforeEach:false, afterEach:false */
/* jshint -W024, -W030 */

var sinon = require('sinon'),
    expect = require('chai').expect,
    rq = require('rq-essentials'),
    messenger = require('../../../server/scripts/messaging'),

    proxyquire = require('proxyquire').noCallThru(),

    rqStub = { '@noCallThru': false },
    utilsStub = { '@noCallThru': false },
    messengerStub = { '@noCallThru': false },

    cqrsService = proxyquire('../../../server/scripts/cqrs-service-api', {
        'rq-essentials': rqStub,
        './utils': utilsStub,
        './messaging': messengerStub//,
    });


describe('CQRS service API specification\'s', function () {
    'use strict';

    //before(function () {});


    //beforeEach(function () {
    //    messenger.resetMessenger();
    //});


    //afterEach(function () {});


    it('should exist', function () {
        expect(cqrsService).to.exist;
        expect(cqrsService).to.be.an('object');
    });


    it('should have CQRS flag, set to false by default', function () {
        expect(cqrsService.getCqrsStatus).to.exist;
        expect(cqrsService.getCqrsStatus).to.be.a('function');
        expect(cqrsService.getCqrsStatus()).to.be.false;
    });


    describe('\'status\' resource function', function () {
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
                        json: assert
                    };
                }),
                response = {
                    status: responseStatusSpy
                },
                assert = function (responseBody) {
                    expect(responseStatusSpy.calledOnce).to.be.true;
                    expect(responseStatusSpy.alwaysCalledWithExactly(405)).to.be.true;
                    //expect(responseBody).to.be.equal('URI \'cqrs/status\' supports GET requests only');

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
                            json: rq.identity
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
                        json: assert
                    };
                }),
                response = {
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
                        json: assert
                    };
                }),
                response = {
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
                        json: assert
                    };
                }),
                response = {
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


        // TODO: Fix this one, weird synchronous test
        /*
         it('should not emit any server push messages', function () {
         var request = {
         method: 'GET'
         },
         response = {
         status: function (statusCode) {
         return {
         json: rq.identity
         };
         }
         };

         //messengerStub.publish = sinon.spy();
         messengerStub.publishAll = sinon.spy();

         cqrsService.status(request, response);

         expect(messengerStub.publish.called).to.be.false;
         });
         */
    });


    describe('\'toggle\' resource function', function () {
        it('should exist', function () {
            expect(cqrsService.toggle).to.exist;
        });


        it('should be a function', function () {
            expect(cqrsService.toggle).to.be.a('function');
        });


        it('should accept HTTP POST only', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'cqrs/toggle'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        json: assert
                    };
                }),
                response = {
                    status: responseStatusSpy
                },
                assert = function (responseBody) {
                    expect(responseStatusSpy.calledOnce).to.be.true;
                    expect(responseStatusSpy.alwaysCalledWithExactly(405)).to.be.true;
                    expect(responseBody).to.be.equal('URI \'cqrs/toggle\' supports POST requests only');

                    done();
                };

            messengerStub.publishAll = sinon.spy();

            cqrsService.toggle(request, response);
        });


        /*
         it('should return nothing (standard REST)', function () {
         var request = {
         method: 'POST',
         originalUrl: 'cqrs/toggle'
         },
         response = {
         sendStatus: function (statusCode) {
         return {
         json: rq.identity
         };
         }
         };

         cqrsService._setCqrsStatus(true);

         messengerStub.publishAll = sinon.spy();

         expect(cqrsService.toggle(request, response)).to.be.undefined;
         });
         */


        it('should send response status code 200 OK', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'cqrs/toggle'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        json: assert
                    };
                }),
                response = {
                    status: responseStatusSpy
                },
                assert = function (responseBody) {
                    expect(responseStatusSpy.calledOnce).to.be.true;
                    expect(responseStatusSpy.alwaysCalledWithExactly(200)).to.be.true;
                    expect(responseBody).to.be.true;

                    done();
                };

            cqrsService._setCqrsStatus(false);

            messengerStub.publishAll = sinon.spy();

            cqrsService.toggle(request, response);
        });


        it('should toggle CQRS status flag', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'cqrs/toggle'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        json: assert
                    };
                }),
                response = {
                    status: responseStatusSpy
                },
                assert = function (responseBody) {
                    expect(cqrsService.getCqrsStatus()).to.be.false;

                    done();
                };

            messengerStub.publishAll = sinon.spy();

            cqrsService._setCqrsStatus(false);
            expect(cqrsService.getCqrsStatus()).to.be.false;
            cqrsService._setCqrsStatus(true);
            expect(cqrsService.getCqrsStatus()).to.be.true;

            cqrsService.toggle(request, response);
        });


        it('should publish \'cqrs\' event containing the current CQRS status boolean flag value (AFTER response has been dispatched)', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'cqrs/toggle'
                },
                responseStatusSpy = sinon.spy(function (statusCode) {
                    return {
                        json: rq.identity
                    };
                }),
                response = {
                    status: responseStatusSpy
                };

            messenger.subscribeOnce('cqrs', function (cqrsStatus) {
                expect(cqrsStatus).to.be.true;

                expect(messengerStub.publishAll.calledOnce).to.be.true;
                expect(messengerStub.publishAll.getCall(0).args.length).to.be.equal(2);
                expect(messengerStub.publishAll.getCall(0).args[0]).to.be.equal('cqrs');
                expect(messengerStub.publishAll.getCall(0).args[1]).to.be.equal(true);

                done();
            });

            cqrsService._setCqrsStatus(false);
            expect(cqrsService.getCqrsStatus()).to.be.false;

            messengerStub.publishAll = sinon.spy(messenger.publishAll);

            cqrsService.toggle(request, response);
        });

        //it('should replay state changes when toggling CQRS status flag from false to true');

        // Nope, set a an event listener, listening for "cqrs"=true => with action replay all state change events
        // Implemented as an "eventsourcing-service-api" responsibility'
    });
});
