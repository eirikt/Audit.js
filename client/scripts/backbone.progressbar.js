/* global define: false */
define(["underscore", "backbone"],

    function (_, Backbone) {
        "use strict";

        /**
         * Progressbar with header text, footer text, and start time.
         */
        return Backbone.Model.extend({
            defaults: {
                // Progressbar model
                started: false,
                inProgress: false,
                finished: false,
                totalCount: null,
                startTime: null,
                progressValueInPercent: 0,

                // Progressbar view-model
                active: false,
                headerText: null,
                footerText: "Please wait ... <br><span class='tiny'>( now what you should do is e.g. stretching your body while waiting :-)</span>"
            },
            //initialize: function () {
            //    console.log("Progressbar.initialize()");
            //},
            start: function (totalCount, startTime) {
                //console.log("Progressbar.start(" + totalCount + ", " + startTime + ")");
                if (this.get("started")) {
                    throw new Error("Cannot start an already started progress bar");
                }
                this.set("started", true, { silent: true });
                if (totalCount) {
                    this.set("totalCount", totalCount, { silent: true });
                }
                this.set("startTime", startTime, { silent: true });
                this.set("progressValueInPercent", 0, { silent: true });
                this.trigger("change");
            },
            progress: function (totalCount, startTime, progressInPercent) {
                //console.log("Progressbar.progress(" + totalCount + ", " + startTime + ", " + progressInPercent + ")");
                // Late to the party?
                if (!this.get("started")) {
                    console.log("Late to the party ... " + startTime);
                    this.start(totalCount, startTime);
                }
                if (!this.get("totalCount")) {
                    this.set("totalCount", totalCount, { silent: true });
                }
                this.set("inProgress", true, { silent: true });
                this.set("progressValueInPercent", progressInPercent, { silent: true });

                // Way out ...
                //if (this.get("progressValueInPercent") > 99.5) {
                //    this.finish();
                //} else {
                this.trigger("change");
                //}
            },
            finish: function () {
                //console.log("Progressbar.finish()");
                this.set("started", false, { silent: true });
                this.set("inProgress", false, { silent: true });
                this.set("finished", true, { silent: true });
                this.set("progressValueInPercent", 100, { silent: true });
                this.trigger("change");
            },
            reset: function () {
                //console.log("Progressbar.reset()");
                if (!this.isFinished() && this.isActive()) {
                    throw new Error("Cannot reset progress bar active and not finished");
                }
                this.set("started", false, { silent: true });
                this.set("inProgress", false, { silent: true });
                this.set("finished", false, { silent: true });
                this.set("totalCount", null, { silent: true });
                this.set("startTime", null, { silent: true });
                this.set("progressValueInPercent", 0, { silent: true });
            },
            isActive: function () {
                return this.get("started") || this.get("inProgress") || this.isFinished();
            },
            isFinished: function () {
                return this.get("finished");
            }
        });
    }
);
