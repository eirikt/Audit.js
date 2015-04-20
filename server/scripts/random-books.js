///////////////////////////////////////////////////////////////////////////////
// Random (simple library domain) test data helper functions
///////////////////////////////////////////////////////////////////////////////

var _ = require('underscore'),


// Tests data elements to be randomly picked
    users = exports.users = ['eric', 'ann', 'tim', 'jeff', 'liz', 'paul'],

    firstNames = exports.firstNames = ['Jo', 'Jon', 'Asle', 'Stig', 'Jens-Kåre', 'Konrad', 'Torstein', 'Ann', 'Anne', 'Anna', 'Dag', 'Jostein', 'Per', 'Per Kristian', 'Stian'],
    lastNames = exports.lastNames = ['Nesbø', 'Pedersen', 'Olsen', 'Jensen', 'Snøfuglien', 'Gaarder', 'Holt', 'Solstad', 'Wolf', 'Nymoen', 'Karlsen'],
    titleElement1 = exports.titleElement1 = ['Dawn', 'Night', 'Sunset', 'Nightfall', 'Party', 'Winter', 'Summertime', 'Apocalypse', 'Journey'],
    titleElement2 = exports.titleElement2 = ['in', 'of', 'on', 'under', 'to'],
    titleElement3 = exports.titleElement3 = ['Earth', 'Mars', 'Andromeda', 'Utopia', 'Antarctica', 'America', 'Europe', 'Africa', 'Asia', 'Oceania'],
    keywords = exports.keywords = ['#scifi', '#thriller', '#fantasy', '#debut', '#novel', '#shortstories', '#pageturner', '#blockbuster', '#rollercoaster'],


    getRandomAlphanumericStringOfLength = exports.getRandomAlphanumericStringOfLength =
        function (length) {
            'use strict';
            return Math.random().toString(36).substr(2, length);
        },

    pickRandomElementFrom = exports.pickRandomElementFrom =
        function (array) {
            'use strict';
            return array[_.random(array.length - 1)];
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

    randomKeyword = exports.randomKeyword =
        function () {
            'use strict';
            return pickRandomElementFrom(keywords);
        },

    createRandomBookAttributes = exports.createRandomBookAttributes =
        function (KeywordType) {
            'use strict';
            return {
                title: randomBookTitle(),
                author: randomName(),
                keywords: [
                    new KeywordType({ keyword: randomKeyword() }),
                    new KeywordType({ keyword: randomKeyword() }),
                    new KeywordType({ keyword: randomKeyword() })
                ]
            };
        };
