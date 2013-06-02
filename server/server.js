// Module dependencies
// https://github.com/mylovecompany/mongoose-pureautoinc
var application_root = __dirname,
    _ = require("underscore"),                              // JavaScript utils
    express = require("express"),                           // Node.js web framework
    path = require("path");                                 // Node.js utilities for dealing with file paths
    //mongoose = require("mongoose"),                         // Node.js MongoDB driver
    //pureautoinc = require('mongoose-pureautoinc'),          // Mongoose autoincrement support
    //deferred = require("promised-io/promise").Deferred();   // Node.js deferred implementation

// Create server
var app = express();

// Configure server
app.configure(function () {
    //parses request body and populates request.body
    //app.use(express.bodyParser());

    //checks request.body for HTTP method overrides
    //app.use(express.methodOverride());

    //perform route lookup based on url and HTTP method
    app.use(app.router);

    //Where to serve static content
    app.use(express.static(path.join(application_root, "../client")));

    //Show all errors in development
    //app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

// Start server
var port = 4711;
app.listen(port, function () {
    console.log('Express server listening on port %d in %s mode', port, app.settings.env);
});

// Route: Get total number of books
app.get("/api/bookcount", function (request, response) {
    return response.send({ count: 0 });
});
