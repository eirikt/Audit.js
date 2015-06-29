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

    /** Random date between start of this year and today ... */
    randomPassedDateFromThisYear =
        function () {
            'use strict';
            var now = new Date(),
                todayDayOfYear = moment(now).dayOfYear(),
                randomDayOfThisYearSoFar = __.random(1, todayDayOfYear),

                minimumDate = new Date(now.getFullYear(), 1, 1),
                randomDateThisYearSoFar = minimumDate.setDate(randomDayOfThisYearSoFar);

            return new Date(randomDateThisYearSoFar);
        },

    createRandomBookAttributes = exports.createRandomBookAttributes =
        function (TagType) {
            'use strict';
            return {
                title: randomBookTitle(),
                author: randomName(),
                tags: [
                    new TagType({ tag: randomTag() }),
                    new TagType({ tag: randomTag() })
                ]
            };
        },

    createRandomVisitAttributes = exports.createRandomVisitAttributes =
        function () {
            'use strict';
            return {
                user: randomName(),
                fromDate: randomPassedDateFromThisYear()
            };
        };
