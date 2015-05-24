var utils = require("./utils.js"),

    /**
     * Constructor function for Socket._clientSidePublisher emitting statistics from MongoDB map-reduce job.
     */
    _MongoDbMapReduceStatisticsSocketIoEmitter = exports.MongoDbMapReduceStatisticsSocketIoEmitter =
        function (socketIoInstance, mongoDbInstance, startTime, name) {
            'use strict';
            this.isValid = socketIoInstance && mongoDbInstance && startTime && name;
            this.inprogCollection = this.isValid ? mongoDbInstance.collection('$cmd.sys.inprog') : null;
            this.intervalProcessId = 0;
            this.start = function (intervalInMilliseconds) {
                if (!this.isValid) {
                    console.warn("MongoDBMapReduceStatisticsSocketIoEmitter is not running as its configuration is not valid");
                } else {
                    var self = this;
                    self.intervalProcessId = setInterval(function () {
                        self.inprogCollection.findOne(function (err, data) {
                            try {
                                var
                                //msg = data.inprog[0].msg,
                                    progress = data.inprog[0].progress;
                                if (progress.total && progress.total > 1) {
                                    socketIoInstance.emit(name, progress.total, startTime, utils.getPercentage(progress.done, progress.total));
                                }
                            } catch (ex) {
                                // Just taking the easy and lazy way out on this one ...
                            }
                        });
                    }, intervalInMilliseconds);
                }
            };
            this.stop = function () {
                if (!this.isValid) {
                    console.warn("MongoDBMapReduceStatisticsSocketIoEmitter is not running as its configuration is not valid");
                } else {
                    clearInterval(this.intervalProcessId);
                }
            };
        };
