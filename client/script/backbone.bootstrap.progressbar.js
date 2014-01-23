/**
 * Stopwatch using 'Moment.js'
 */
Stopwatch = Backbone.Model.extend({
    defaults: {
        startTime: null,
        intervalFunctionId: null,
        format: "HH:mm:ss",
        elapsed: null
    },
    isStarted: function () {
        return this.get("startTime") !== null;
    },
    start: function (startTime) {
        var self = this;
        this.stop();
        if (startTime) {
            this.set("startTime", startTime, { silent: true });
        } else {
            this.set("startTime", Date.now(), { silent: true });
        }
        this.set("elapsed", moment(0).utc().format(self.get("format")));
        this.intervalFunctionId = setInterval(function () {
            var elapsedMilliseconds = Date.now() - self.get("startTime");
            self.set("elapsed", moment(elapsedMilliseconds).utc().format(self.get("format")));
        }, 1000);
    },
    stop: function () {
        clearInterval(this.intervalFunctionId);
        this.set("startTime", null, { silent: true });
    }
});


StopwatchView = Backbone.View.extend({
    tagName: "span",
    className: "tiny",
    template: _.template("Elapsed:&nbsp;<strong><%= elapsed %></strong>"),
    initialize: function () {
        this.listenTo(this.model, "change", this.render);
    },
    render: function () {
        this.$el.empty().append(this.template(this.model.toJSON()));
        return this;
    }
});


/**
 * Progressbar with header text, footer text, and start time.
 */
Progressbar = Backbone.Model.extend({
    defaults: {
        // Model
        enabled: false, // Meaning: is started
        finished: false,
        progressValueInPercent: 0,
        startTime: null,

        // View-model
        visible: false,
        headerText: null,
        footerText: "Please wait ... <br><span class='tiny'>( now what you should do is e.g. stretching your body while waiting :-)</span>"
    },
    start: function (startTime) {
        if (this.get("enabled")) {
            throw new Error("Cannot start an already started progress bar");
        }
        this.set("visible", true, { silent: true });
        this.set("enabled", true, { silent: true });
        this.set("progressValueInPercent", 0, { silent: true });
        this.set("startTime", startTime, { silent: true });
        this.trigger("change");
    },
    progress: function (inPercent, startTime) {
        // Late to the party?
        if (!this.get("visible") && !this.get("enabled")) {
            console.log("Late to the party ... " + startTime);
            this.start(startTime);
        }
        this.set("progressValueInPercent", inPercent, { silent: true });

        // Way out!
        if (this.get("progressValueInPercent") > 99.5) {
            this.finish();

        } else {
            this.trigger("change");
        }
    },
    finish: function () {
        this.set("visible", false, { silent: true });
        this.set("progressValueInPercent", 100, { silent: true });
        this.trigger("change");
    },
    reset: function () {
        this.set("visible", false, { silent: true });
        this.set("enabled", false, { silent: true });
        this.set("progressValueInPercent", 0, { silent: true });
        this.set("startTime", null, { silent: true });
    }
});


ProgressbarCollection = Backbone.Collection.extend({
    model: Progressbar
});


SimpleUnderscoreTemplateView = Backbone.View.extend({
    initialize: function (attr) {
        this.model = attr.model;
        this.template = _.template($(attr.templateSelector).html());
        this.render();
    },
    render: function () {
        this.$el.empty().append(this.template(this.model.toJSON()));
    }
});


/**
 * Modal Bootstrap dialog with multiple progress bars, and a stopwatch showing the overall elapsed time.
 */
BootstrapModalMultipleProgressbarView = Backbone.View.extend({
    templateSelector: "#bootstrapModalMultipleProgressbarTemplate",

    initialize: function () {
        this.stopwatch = new Stopwatch();
        this.stopwatchView = new StopwatchView({
            model: this.stopwatch
        });
        this.listenTo(this.model, "change", this.render);
        this.listenTo(this.collection, "change sync", this.render);

        this.$el.append(_.template($(this.templateSelector).html())(this.model.toJSON()));
        this.$("#stopwatch").append(this.stopwatchView.el);

        $("body").prepend(this.render().el);
    },
    show: function (earliestStartTime) {
        this.$("#modalMultipleProgressbar").modal({
            show: true,
            backdrop: "static",
            keyboard: false,
            remote: false
        });
        if (!this.stopwatch.isStarted()) {
            console.log("NOT STARTED, starting with " + earliestStartTime);
            this.stopwatch.start(earliestStartTime);
        }
    },
    hide: function () {
        this.$("#modalMultipleProgressbar").modal("hide");
        $(".modal-backdrop").remove();
        $("body").removeClass("modal-open");
        this.stopwatch.stop();
    },
    areAnyProgressbarsVisible: function () {
        return this.collection.any(function (progressbar) {
            return progressbar.get("visible");
        }, this);
    },
    areAnyProgressbarsStarted: function () {
        return this.collection.any(function (progressbar) {
            return progressbar.get("enabled");
        }, this);
    },
    render: function () {
        var self = this,
            earliestStartTime = new Date().getTime();
        this.$("#progressbars").empty();
        if (this.areAnyProgressbarsVisible()) {
            this.collection.each(function (progressbar) {
                if (progressbar.get("visible") || progressbar.get("enabled")) {
                    self.$("#progressbars").append(
                        new SimpleUnderscoreTemplateView({
                            templateSelector: "#bootstrapProgressbarTemplate",
                            model: progressbar
                        }).el
                    );
                    if (progressbar.get("startTime") != null && progressbar.get("startTime") < earliestStartTime) {
                        earliestStartTime = progressbar.get("startTime");
                    }
                } else {
                    self.$("#progressbars").append(
                        new SimpleUnderscoreTemplateView({
                            templateSelector: "#bootstrapProgressbarUnknownStateTemplate",
                            model: progressbar
                        }).el
                    );
                }
            });
            this.show(earliestStartTime);

        } else if (this.areAnyProgressbarsStarted()) {
            this.hide();
            this.collection.each(function (progressbar) {
                progressbar.reset();
            });
        }
        return this;
    }
});
