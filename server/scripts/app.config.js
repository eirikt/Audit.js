var moment = require('moment'),
    rq = require('RQ-essentials'),


// Application configuration
    appConfig = {

        doLog: rq.doLog,
        doNotLog: rq.doNotLog,

        /**
         * A simple timestamp in brackets, suitable for log line preambles.
         * @returns {String} Simple date-in-square-brackets string
         */
        logPreamble: function () {
            'use strict';
            return '[' + moment().format('YYYY-MM-DD HH:mm:ss') + '] Audit.js :: ';
        }
    };

exports.config = appConfig;
