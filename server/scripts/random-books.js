///////////////////////////////////////////////////////////////////////////////
// Random (simple library domain) test data helper functions
///////////////////////////////////////////////////////////////////////////////

var __ = require('underscore'),
    moment = require('moment'),


// Tests data elements to be randomly picked
    users = exports.users = ['eric', 'ann', 'tim', 'jeff', 'liz', 'paul'],

    firstNames = exports.firstNames = ['Jo', 'Jon', 'Asle', 'Stig', 'Jens-Kåre', 'Konrad', 'Torstein', 'Ann', 'Anne', 'Anna', 'Dag', 'Jostein', 'Per', 'Per Kristian', 'Stian'],
    lastNames = exports.lastNames = ['Nesbø', 'Pedersen', 'Olsen', 'Jensen', 'Snøfuglien', 'Gaarder', 'Holt', 'Solstad', 'Wolf', 'Nymoen', 'Karlsen'],
    titleElement1 = exports.titleElement1 = ['Dawn', 'Night', 'Sunset', 'Nightfall', 'Party', 'Winter', 'Summertime', 'Apocalypse', 'Journey'],
    titleElement2 = exports.titleElement2 = ['in', 'of', 'on', 'under', 'to'],
    titleElement3 = exports.titleElement3 = ['Earth', 'Mars', 'Andromeda', 'Utopia', 'Antarctica', 'America', 'Europe', 'Africa', 'Asia', 'Oceania'],
    tags = exports.tags = ['scifi', 'thriller', 'fantasy', 'debut', 'novel', 'shortstories', 'pageturner', 'blockbuster', 'rollercoaster'],


    getRandomAlphanumericStringOfLength = exports.getRandomAlphanumericStringOfLength =
        function (length) {
            'use strict';
            return Math.random().toString(36).substr(2, length);
        },

    pickRandomElementFrom = exports.pickRandomElementFrom =
        function (array) {
            'use strict';
            return array[__.random(array.length - 1)];
        },

    randomUser = exports.randomUser =
        function () {
            'use strict';
            return pickRandomElementFrom(users);
        },

    randomBookTitle = exports.randomBookTitle =
        function () {
            'use strict';
            return pickRandomElementFrom(titleElement1) + ' ' +
                pickRandomElementFrom(titleElement2) + ' ' +
                pickRandomElementFrom(titleElement3);
        },

    randomName = exports.randomName =
        function () {
            'use strict';
            return pickRandomElementFrom(firstNames) + ' ' + pickRandomElementFrom(lastNames);
        },

    randomTag = exports.randomTag =
        function () {
            'use strict';
            return pickRandomElementFrom(tags);
        },

    randomDateAfter = exports.randomDateAfter =
        function (earliestDate, dayInterval) {
            'use strict';
            var randomDayOfThisYearSoFar = __.random(1, dayInterval),
                earliestDateClone = new Date(earliestDate.valueOf());

            earliestDateClone.setDate(earliestDateClone.getDate() + randomDayOfThisYearSoFar);

            return earliestDateClone;
        },

    /** Random date between start of this year and today ... */
    randomPassedDateFromThisYear =
        function () {
            'use strict';
            var now = new Date(),
                firstDateThisYear = new Date(now.getFullYear(), 1, 1),
                todayDayOfYear = moment(now).dayOfYear();

            return randomDateAfter(firstDateThisYear, todayDayOfYear);
        },

    /** A rather library domain-specific utility functions ... */
    getRandomLoanReturnDateForVisit = exports.getRandomLoanReturnDateForVisit =
        function (visit) {
            'use strict';
            //return randomDateAfter(visit.changes.fromDate, visit.changes.loanPeriodInDays);

            var today = new Date(),
                randomDateInLoanPeriod = randomDateAfter(visit.changes.fromDate, visit.changes.loanPeriodInDays),
                rand = Math.random();

            // 50% chance of returning null if (visit.changes.fromDate + visit.changes.loanPeriodInDays) is after today's date
            if (randomDateInLoanPeriod.valueOf() > today.valueOf()) {
                if (rand > 0.5) {
                    return null;
                }
            }

            // 10% chance of returning null if (visit.changes.fromDate + visit.changes.loanPeriodInDays) is BEFORE today's date
            if (rand > 0.9) {
                return null;
            }

            return randomDateInLoanPeriod;
        },

    createRandomBookAttributes = exports.createRandomBookAttributes =
        function (Tag) {
            'use strict';

            // Create at most two unique tags from prefabricated array of possible tags
            var tagArray = [],
                tagStringArray = [randomTag()],
                lastRandomTag = randomTag();

            if (tagStringArray[0] !== lastRandomTag) {
                tagStringArray.push(lastRandomTag);
            }
            tagStringArray.forEach(function (tagString) {
                tagArray.push(new Tag({ name: tagString }));
            });

            return {
                title: randomBookTitle(),
                author: randomName(),
                tags: tagArray
            };
        },

    createRandomVisitAttributes = exports.createRandomVisitAttributes =
        function () {
            'use strict';
            var visitDate = randomPassedDateFromThisYear();
            return {
                fromDate: visitDate,
                toDate: visitDate,
                resources: randomName(),
                location: null
            };
        };
