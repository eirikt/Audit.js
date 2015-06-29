require.config({
    paths: {
        // Socket.IO client lib must be manually copied from node_modules
        'socket.io': 'vendor/socket.io',

        'jquery': '../bower_components/jquery/dist/jquery',
        'jquery.bootstrap': '../bower_components/bootstrap/dist/js/bootstrap',
        'jquery.bindwithdelay': 'vendor/jquery.bind-with-delay',
        'underscore': '../bower_components/underscore/underscore',
        'backbone': '../bower_components/backbone/backbone',
        'moment': '../bower_components/moment/moment',
        'spin': '../bower_components/spin.js/spin'
    },
    shim: {
        jquery: {
            exports: '$'
        },
        'jquery.bootstrap': {
            deps: ['jquery'],
            exports: '$'
        },
        'jquery.bindwithdelay': {
            deps: ['jquery'],
            exports: 'BindWithDelay'
        },
        enforceDefine: true
    },
    config: {
        moment: {
            noGlobal: true
        }
    }
});

// Loading and startup
require(['socket.io', 'jquery.bindwithdelay', 'app'], function () {
});
