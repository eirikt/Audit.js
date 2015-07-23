var

// MongoDB URL
    dbUrl = 'mongodb://localhost/library',

// Connect to database via MongoDB native driver
    db = exports.db = null,

// Connect to database via Mongoose
    mongoose = exports.mongoose = require('mongoose'),

    mongodb = require('mongodb'),
    utils = require('./utils'),

    app = require('./app.config');


// TODO: Check out http://stackoverflow.com/questions/18688282/handling-timeouts-with-node-js-and-mongodb
mongodb.MongoClient.connect(dbUrl, function (err, mongodb) {
    'use strict';
    if (err) {
        console.error(app.config.logPreamble() + 'MongoDB native driver connected to \'' + dbUrl + '\' ...');
        //throw new Error('Could not connect to \'' + dbUrl + '\'!');
    }
    console.log(app.config.logPreamble() + 'MongoDB native driver connected to \'' + dbUrl + '\' ...');
    db = exports.db = mongodb;
});

// TODO: Check out: http://stackoverflow.com/questions/24030990/mongoose-odd-behaviour-with-sockettimeoutms-in-connection-options
mongoose.connect(dbUrl);
