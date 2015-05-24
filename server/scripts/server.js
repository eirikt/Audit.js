/* global root:false */

///////////////////////////////////////////////////////////////////////////////
// Library application / micro service
///////////////////////////////////////////////////////////////////////////////

// Library database configurations
require("./mongodb.config");

// Library resources, route declarations => services configurations
require('./library-routes.express');

// TODO: Include other base configs; Socket.IO, Express, ... ? Is it any point, readability in mind and so on

// Library application store (read-only queries only) (very simple and naive implementation based on regular arrays)
// Added for completeness - not needed really - required in 'library-service-api.js'
//require("./library-application-store.naive-inmemory");

// Library application store (read-only queries only) (based on MongoDB)
//require('./library-application-store.mongodb');

// Library application store manager
require('./library-application-store-manager');


// Application configuration
root.app = {};
root.app.config = {
    timeoutInMilliseconds: 2000
};


// Message bus testing ...
var messageBus = require('./messaging');

messageBus.subscribe(['naive-inmemory_consistent'], function (message) {
    'use strict';
    console.log('Application store \'naive-inmemory.consistent=' + message + '\' subscription message received');
});
