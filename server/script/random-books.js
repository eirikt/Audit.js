
///////////////////////////////////////////////////////////////////////////////
// Random (library domain) test data helper functions
///////////////////////////////////////////////////////////////////////////////

_ = require("underscore");


// Tests data elements to be randomly picked
var users = exports.users = ["eric", "ann", "tim", "jeff", "liz", "paul"];

var firstNames = exports.firstNames = ["Jo", "Jon", "Asle", "Stig", "Jens-Kåre", "Konrad", "Torstein", "Ann", "Anne", "Anna", "Dag", "Jostein", "Per", "Per Kristian", "Stian"];
var lastNames = exports.lastNames = ["Nesbø", "Pedersen", "Olsen", "Jensen", "Snøfuglien", "Gaarder", "Holt", "Solstad", "Wolf", "Nymoen", "Karlsen"];
var titleElement1 = exports.titleElement1 = ["Dawn", "Night", "Sunset", "Nightfall", "Party", "Winter", "Summertime", "Apocalypse", "Journey"];
var titleElement2 = exports.titleElement2 = ["in", "of", "on", "under", "to"];
var titleElement3 = exports.titleElement3 = ["Earth", "Mars", "Andromeda", "Utopia", "Antarctica", "America", "Europe", "Africa", "Asia", "Oceania"];
var keywords = exports.keywords = ["#scifi", "#thriller", "#fantasy", "#debut", "#novel", "#shortstories", "#pageturner", "#blockbuster", "#rollercoaster"];


var getRandomAlphanumericStringOfLength = exports.getRandomAlphanumericStringOfLength = function (length) {
    return Math.random().toString(36).substr(2, length);
};

var pickRandomElementFrom = exports.pickRandomElementFrom = function (array) {
    return array[_.random(array.length - 1)];
};

var randomUser = exports.randomUser = function () {
    return pickRandomElementFrom(users);
};

var randomBookTitle = exports.randomBookTitle = function () {
    return pickRandomElementFrom(titleElement1) + " " +
        pickRandomElementFrom(titleElement2) + " " +
        pickRandomElementFrom(titleElement3);
};

var randomName = exports.randomName = function () {
    return pickRandomElementFrom(firstNames) + " " + pickRandomElementFrom(lastNames);
};

var randomKeyword = exports.randomKeyword = function () {
    return pickRandomElementFrom(keywords);
};
