///////////////////////////////////////////////////////////////////////////////
// Library application / micro service
///////////////////////////////////////////////////////////////////////////////

var moment = require('moment'),
    rq = require('RQ-essentials'),
    app = require('./app.config');


// Library database configurations
require('./mongodb.config');

// Library resources, route declarations => services configurations
require('./library-routes.express');

// TODO: Include other base configs; Socket.IO, Express, ... ? Is it any point, having readability in mind and so on

// Library application stores (read-only queries only) (very simple and naive implementation based on regular arrays)
require('./library-application-store-manager');


// Message bus testing ...
var messageBus = require('./messaging'),
    utils = require('./utils');

// TODO: Try with '.' as delimiter
//messageBus.subscribe(['naive-inmemory.consistent'], function (message) {
messageBus.subscribe(['naive-inmemory_consistent'], function (message) {
    'use strict';
    console.log(app.config.logPreamble + 'Application store \'naive-inmemory.consistent=' + message + '\' subscription message received');
});
