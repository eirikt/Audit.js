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


    describe('\'isBookOnLoan\' function', function () {

        it('should exist as a function', function () {
            expect(libraryService.isBookOnLoan).to.exist;
            expect(libraryService.isBookOnLoan).to.be.a('function');
        });


        it('should accept HTTP GET only', function (done) {
            var request = {
                    method: 'POST',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066/loans/isonloan',
                    params: { entityId: '55542f4556a413fc0b7fa066' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.be.equal(405);
                                expect(responseBody).to.be.equal('URI \'library/books/55542f4556a413fc0b7fa066/loans/isonloan\' supports GET requests only');

                                done();
                            }
                        };
                    }
                };

            libraryService.isBookOnLoan(request, response);
        });


        it('should send response status code 400 Bad Request when missing resource element \'entityId\'', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066/loans/isonloan',
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

            libraryService.isBookOnLoan(request, response);
        });


        it('should send response status code 500 Internal Server Error when more than one missing return date exist for the same book', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066/loans/isonloan',
                    params: { entityId: '55542f4556a413fc0b7fa066' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            send: function (responseBody) {
                                expect(responseStatusCode).to.equal(500);

                                done();
                            }
                        };
                    }
                };

            eventSourcingStub.find = sinon.spy(function (entityId) {
                return function requestor(callback, args) {
                    var bookLoanArray = [],
                        queryResult = { find: bookLoanArray },
                        bookLoan1 = { value: {} },
                        bookLoan2 = { value: {} };

                    bookLoanArray.push(bookLoan1);
                    bookLoanArray.push(bookLoan2);

                    return callback(queryResult, undefined);
                };
            });

            libraryService.isBookOnLoan(request, response);
        });


        it('should send response status code 200 OK and body element \'isOnLoan\' set to true if a return date is missing', function (done) {
            var request = {
                    method: 'GET',
                    originalUrl: 'library/books/55542f4556a413fc0b7fa066/loans/isonloan',
                    params: { entityId: '55542f4556a413fc0b7fa066' }
                },
                response = {
                    status: function (responseStatusCode) {
                        return {
                            json: function (responseBody) {
                                expect(responseStatusCode).to.equal(200);
                                expect(responseBody).to.exist;
                                expect(responseBody.isOnLoan).to.be.true;

                                done();
                            }
                        };
                    }
                };

            eventSourcingStub.find = sinon.spy(function (entityId) {
                return function requestor(callback, args) {
                    var bookLoanArray = [],
                        queryResult = { find: bookLoanArray },
                        bookLoan1 = { value: {} },
                        bookLoan2 = { value: { returnDate: new Date() } };

                    bookLoanArray.push(bookLoan1);
                    bookLoanArray.push(bookLoan2);

                    return callback(queryResult, undefined);
                };
            });

            libraryService.isBookOnLoan(request, response);
        });
    });


    it('should send response status code 200 OK and body element \'isOnLoan\' set to false if no loans exists', function (done) {
        var request = {
                method: 'GET',
                originalUrl: 'library/books/55542f4556a413fc0b7fa066/loans/isonloan',
                params: { entityId: '55542f4556a413fc0b7fa066' }
            },
            response = {
                status: function (responseStatusCode) {
                    return {
                        json: function (responseBody) {
                            expect(responseStatusCode).to.equal(200);
                            expect(responseBody).to.exist;
                            expect(responseBody.isOnLoan).to.be.false;

                            done();
                        }
                    };
                }
            };

        eventSourcingStub.find = sinon.spy(function (entityId) {
            return function requestor(callback, args) {
                var bookLoanArray = [],
                    queryResult = { find: bookLoanArray };

                return callback(queryResult, undefined);
            };
        });

        libraryService.isBookOnLoan(request, response);
    });


    it('should send response status code 200 OK and body element \'isOnLoan\' set to false if all return dates exist', function (done) {
        var request = {
                method: 'GET',
                originalUrl: 'library/books/55542f4556a413fc0b7fa066/loans/isonloan',
                params: { entityId: '55542f4556a413fc0b7fa066' }
            },
            response = {
                status: function (responseStatusCode) {
                    return {
                        json: function (responseBody) {
                            expect(responseStatusCode).to.equal(200);
                            expect(responseBody).to.exist;
                            expect(responseBody.isOnLoan).to.be.false;

                            done();
                        }
                    };
                }
            };

        eventSourcingStub.find = sinon.spy(function (entityId) {
            return function requestor(callback, args) {
                var bookLoanArray = [],
                    queryResult = { find: bookLoanArray },
                    bookLoan1 = { value: { returnDate: new Date() } },
                    bookLoan2 = { value: { returnDate: new Date() } };

                bookLoanArray.push(bookLoan1);
                bookLoanArray.push(bookLoan2);

                return callback(queryResult, undefined);
            };
        });

        libraryService.isBookOnLoan(request, response);
    });
});
