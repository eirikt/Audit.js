define(["underscore", "backbone", "moment"]

    , function (_, Backbone, Moment) {
        "use strict";

        /**
         * Watch using 'Moment.js'.
         * Ticks and triggers every second when started.
         */
        return Backbone.Model.extend({
            defaults: {
                intervalFunctionId: null,
                format: "HH:mm:ss",
                startTime: null,
                elapsed: null,
                user: "unknown",
                totalCount: "unknown"
            },
            isStarted: function () {
                return this.get("startTime") !== null;
            },
            start: function (startTime, totalCount) {
                var self = this;
                this.stop();
                this.intervalFunctionId = setInterval(function () {
                    var elapsedMilliseconds = Date.now() - self.get("startTime");
                    self.set("elapsed", Moment(elapsedMilliseconds).utc().format(self.get("format")));
                }, 1000);

                if (startTime) {
                    this.set("startTime", startTime, { silent: true });
                } else {
                    this.set("startTime", Date.now(), { silent: true });
                }
                this.set("elapsed", Moment(0).utc().format(self.get("format")), { silent: true });
                if (totalCount) {
                    this.set("totalCount", totalCount, { silent: true });
                }
                this.trigger("change");
            },
            stop: function () {
                clearInterval(this.intervalFunctionId);
                this.set("startTime", null, { silent: true });
                this.set("elapsed", null, { silent: true });
                this.set("user", "unknown", { silent: true });
                this.set("totalCount", "unknown", { silent: true });
            }
        });
    }
);
