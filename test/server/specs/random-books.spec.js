/* global describe:false, it:false */

var expect = require('chai').expect,
    randomBooksUtils = require('../../../server/scripts/random-books');

describe('Random books utilities', function () {
    'use strict';

    describe('Create random dates', function () {

        it('should return random date after given date, max days included', function () {
            var someDate = new Date(2015, (7 - 1), 18),
                fourDaysAfter = new Date(2015, (7 - 1), 22),
                randomDay = randomBooksUtils.randomDateAfter(someDate, 3);

            //expect(randomDay.valueOf()).to.be.above(someDate.valueOf()); // Later, that is
            //expect(randomDay.valueOf()).to.be.below(fourDaysAfter.valueOf()); // Before, that is
            expect(randomDay).to.be.above(someDate); // Later, that is
            expect(randomDay).to.be.below(fourDaysAfter); // Before, that is
        });


        it('should return random book loan return dates, high probability (~50%) for missing return dates', function () {
            var visit = {},
                visitDate = new Date(),
                i = 0,
                visitReturnDates = [],
                missingVisitReturnDates = 0;

            visit.changes = {};
            visit.changes.fromDate = visitDate;
            visit.changes.loanPeriodInDays = 30;

            for (; i < 100; i += 1) {
                visitReturnDates.push(randomBooksUtils.getRandomLoanReturnDateForVisit(visit));
            }

            expect(visitReturnDates.length).to.be.equal(100);

            for (i = 0; i < visitReturnDates.length; i += 1) {
                if (!visitReturnDates[i]) {
                    missingVisitReturnDates += 1;
                }
            }
            expect(missingVisitReturnDates).to.be.below(100);
            expect(missingVisitReturnDates).to.be.above(40);
        });


        it('should return random book loan return dates, low probability (~10%) for missing return dates', function () {
            var visit = {},
                today = new Date(),
                visitDate = new Date(today.getFullYear() - 1), // One year ago
                i = 0,
                visitReturnDates = [],
                missingVisitReturnDates = 0;

            visit.changes = {};
            visit.changes.fromDate = visitDate;
            visit.changes.loanPeriodInDays = 30;

            for (; i < 100; i += 1) {
                visitReturnDates.push(randomBooksUtils.getRandomLoanReturnDateForVisit(visit));
            }

            expect(visitReturnDates.length).to.be.equal(100);

            for (i = 0; i < visitReturnDates.length; i += 1) {
                if (!visitReturnDates[i]) {
                    missingVisitReturnDates += 1;
                }
            }
            expect(missingVisitReturnDates).to.be.below(100);
            expect(missingVisitReturnDates).to.be.above(5);
        });
    });
});
