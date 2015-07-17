/* global JSON:false */
/* jshint -W024 */

var clientResourceRoot = '../../client',
    applicationRoot = __dirname,

    http = require('http'),
    path = require('path'),
    bodyParser = require('body-parser'),
    express = require('express'),
    utils = require('./utils'),

// Establish Express "app server" (routing, parsing, ...)
    port = exports.port = 4711,
    app,
    server;

app = express();
app.use(bodyParser.json());                                              // To support JSON-encoded bodies
app.use(bodyParser.urlencoded({ extended: true }));                      // To support URL-encoded bodies
app.use(express.static(path.join(applicationRoot, clientResourceRoot)));

exports.appServer = app;


// Establish and start Express HTTP server
server = exports.httpServer = http.createServer(app);
server.listen(port, function () {
    'use strict';
    console.log(utils.logPreamble() + 'Express server listening on port %d', port);
});


// TODO: Consider logging to file (or use logger)
// E.g. using example from http://stackoverflow.com/questions/8393636/node-log-in-a-file-instead-of-the-console:
//
//var fs = require('fs');
//var util = require('util');
//var log_file = fs.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
//var log_stdout = process.stdout;
//
//console.log = function(d) { //
//    log_file.write(util.format(d) + '\n');
//    log_stdout.write(util.format(d) + '\n');
//};
