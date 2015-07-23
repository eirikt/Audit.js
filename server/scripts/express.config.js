/* global JSON:false */
/* jshint -W024 */

var clientResourceRoot = '../../client',
    applicationRoot = __dirname,

    http = require('http'),
    path = require('path'),
    bodyParser = require('body-parser'),
    express = require('express'),
    utils = require('./utils'),

    app = require('./app.config'),

// Establish Express "app server" (routing, parsing, ...)
    port = exports.port = 4711,
    appServer,
    server;

appServer = express();
appServer.use(bodyParser.json());                                              // To support JSON-encoded bodies
appServer.use(bodyParser.urlencoded({ extended: true }));                      // To support URL-encoded bodies
appServer.use(express.static(path.join(applicationRoot, clientResourceRoot)));

exports.appServer = appServer;


// Establish and start Express HTTP server
server = exports.httpServer = http.createServer(appServer);
server.listen(port, function () {
    'use strict';
    console.log(app.config.logPreamble() + 'Express server listening on port %d', port);
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
