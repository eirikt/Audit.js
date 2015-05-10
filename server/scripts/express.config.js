var clientResourceRoot = '../../client',
    applicationRoot = __dirname,

    http = require('http'),
    path = require('path'),
    bodyParser = require('body-parser'),
    express = require('express'),


// Establish Express "app server" (routing, parsing, ...)
    port = 4711,
    app,
    server;

app = express();
app.use(bodyParser.json());     // To support JSON-encoded bodies
app.use(bodyParser.urlencoded({ // To support URL-encoded bodies
    extended: true
}));
app.use(express.static(path.join(applicationRoot, clientResourceRoot)));

exports.appServer = app;


// Establish and start Express HTTP server
server = exports.httpServer = http.createServer(app);
server.listen(port, function () {
    'use strict';
    console.log('Express server listening on port %d', port);
});


// TODO: Consider logging to file
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
