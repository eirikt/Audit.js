require.config({
    paths: {
        'socket.io': 'vendor/socket.io.min',
        'jquery': '../bower_components/jquery/dist/jquery.min',
        'jquery.bootstrap': '../bower_components/bootstrap/dist/js/bootstrap.min',
        'jquery.bindwithdelay': 'vendor/jquery.bind-with-delay',

        // TODO: Bower... where are these??
        //'underscore': '../bower_components/underscore/underscore-min',
        //'backbone': '../bower_components/backbone/backbone-min',
        'underscore': '../bower_components/underscore/underscore',
        'backbone': '../bower_components/backbone/backbone',

        'moment': '../bower_components/moment/min/moment.min'
    },
    shim: {
        // TODO: RequireJS and Socket.IO ...
        //'socket.io': {
        //    deps: [],
        //    exports: 'SocketIo'
        //},
        'jquery.bootstrap': {
            deps: ['jquery'],
            exports: 'Bootstrap'
        },
        'jquery.bindwithdelay': {
            deps: ['jquery'],
            exports: 'BindWithDelay'
        },
        'underscore': {
            deps: [],
            exports: '_'
        },
        'backbone': {
            deps: ['underscore'],
            exports: 'Backbone'
        },
        'moment': {
            deps: [],
            exports: 'Moment'
        }
    }
});

// Loading and startup
require(['jquery.bindwithdelay'], function () {
});

require(['app'], function () {
});
