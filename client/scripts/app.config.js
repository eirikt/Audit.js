require.config({
    paths: {
        'socket.io': 'vendor/socket.io',
        'jquery': '../bower_components/jquery/dist/jquery',
        'jquery.bootstrap': '../bower_components/bootstrap/dist/js/bootstrap',
        'jquery.bindwithdelay': 'vendor/jquery.bind-with-delay',
        'underscore': '../bower_components/underscore/underscore',
        'backbone': '../bower_components/backbone/backbone',
        'moment': '../bower_components/moment/moment'
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
require(['socket.io', 'jquery.bindwithdelay', 'app'], function () { });
