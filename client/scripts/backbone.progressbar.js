define(["underscore", "backbone"]

    /**
     * Progressbar with header text, footer text, and start time.
     */
    , function (_, Backbone) {
        "use strict";

        return Backbone.Model.extend({
            defaults: {
                // Model
                enabled: false, // Meaning: is started
                finished: false,
                totalCount: null,
                startTime: null,
                progressValueInPercent: 0,

                // View-model
                visible: false,
                headerText: null,
                footerText: "Please wait ... <br><span class='tiny'>( now what you should do is e.g. stretching your body while waiting :-)</span>"
            },
            start: function (totalCount, startTime) {
                console.log("Progressbar.start(" + totalCount + ", " + startTime + ")");
                if (this.get("enabled")) {
                    throw new Error("Cannot start an already started progress bar");
                }
                this.set("visible", true, { silent: true });
                this.set("enabled", true, { silent: true });
                if (totalCount) {
                    this.set("totalCount", totalCount, { silent: true });
                }
                this.set("startTime", startTime, { silent: true });
                this.set("progressValueInPercent", 0, { silent: true });
                this.trigger("change");
            },
            progress: function (totalCount, startTime, progressInPercent) {
                console.log("Progressbar.progress(" + totalCount + ", " + startTime + ", " + progressInPercent + ")");
                // Late to the party?
                if (!this.get("visible") && !this.get("enabled")) {
                    console.log("Late to the party ... " + startTime);
                    this.start(totalCount, startTime);
                }
                if (!this.get("totalCount")) {
                    this.set("totalCount", totalCount, { silent: true });
                }
                this.set("progressValueInPercent", progressInPercent, { silent: true });

                // Way out!
                if (this.get("progressValueInPercent") > 99.5) {
                    this.finish();

                } else {
                    this.trigger("change");
                }
            },
            finish: function () {
                console.log("Progressbar.finish()");
                this.set("visible", false, { silent: true });
                this.set("progressValueInPercent", 100, { silent: true });
                this.trigger("change");
            },
            reset: function () {
                console.log("Progressbar.reset()");
                this.set("visible", false, { silent: true });
                this.set("enabled", false, { silent: true });
                this.set("totalCount", null, { silent: true });
                this.set("startTime", null, { silent: true });
                this.set("progressValueInPercent", 0, { silent: true });
            }
        });
    }
);
