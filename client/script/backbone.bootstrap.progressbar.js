Progressbar = Backbone.Model.extend({
    defaults: {
        // Model
        enabled: false, // Meaning: is started
        finished: false,
        current: 0,
        total: 100,
        progressValueInPercent: 0,

        // View-model
        visible: false,
        headerText: null,
        footerText: "Please wait ... <br>(what you should do is e.g. stretching your body while waiting :-)"
    },
    start: function (total) {
        if (this.get("enabled")) {
            throw new Error("Cannot start an already started progress bar");
        }
        this.set("visible", true, { silent: true });
        this.set("enabled", true, { silent: true });
        this.set("total", total);
    },
    progress: function (current, total) {
        // Late to the party ...?
        if (!this.get("visible") && !this.get("enabled")) {
            this.set("current", current, { silent: true });
            this.start(total);
        }
        var currentVal = this.get("current"),
            totalVal = this.get("total"),
            incrementedValue = currentVal + 1,
            progressValueProgressRatio = incrementedValue / totalVal,
            progressValueProgressInPercent = Math.floor(progressValueProgressRatio * 100),
            resultingCurrent = null,
            resultingTotal = null;
        this.set("current", incrementedValue, { silent: true });
        this.set("progressValueInPercent", progressValueProgressInPercent);

        // Way out ...
        // TODO: consider more robust way out with timeout and 'window.location.reload()'
        resultingCurrent = Math.max(incrementedValue, current);
        resultingTotal = Math.min(totalVal, total);
        if (resultingCurrent >= resultingTotal) {
            this.finish(resultingTotal);
        }
    },
    finish: function (last) {
        this.set("visible", false);
    },
    reset: function () {
        this.set("visible", false, { silent: true });

        this.set("enabled", false, { silent: true });
        this.set("current", 0, { silent: true });
        this.set("total", 100, { silent: true });
        this.set("progressValueInPercent", 0, { silent: true });
    }
});


ProgressbarCollection = Backbone.Collection.extend({
    model: Progressbar
});


BootstrapModalProgressbarView = Backbone.View.extend({
    templateSelector: "#bootstrapModalProgressbarTemplate",
    template: null,

    initialize: function () {
        this.listenTo(this.model, "change", this.render);
        this.render();
        $("body").prepend(this.el);
    },
    render: function () {
        this.$el.html(_.template($(this.templateSelector).html(), this.model.toJSON()));

        if (this.model.get("visible")) {
            this.$("#modalProgressbar").modal({ // OK
                // TODO: try:
                //this.$(".modal").modal({ // Works ... only one at a time should be active/visible so ...
                show: true,
                //backdrop: "static",
                keyboard: false,
                remote: false
            });
            this.model.set("enabled", true, { silent: true });

        } else {
            if (this.model.get("enabled")) {
                this.model.reset();
                this.$("#modalProgressbar").modal("hide");
                $(".modal-backdrop").remove();
                $("body").removeClass("modal-open");
            }
        }
        return this;
    }
});


BootstrapModalMultipleProgressbarView = Backbone.View.extend({
    templateSelector: "#bootstrapModalMultipleProgressbarTemplate",
    template: null,

    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.model, "change", this.render);
        this.listenTo(this.collection, "change sync", this.render);
        this.render();
        $("body").prepend(this.el);
    },
    show: function () {
        this.$("#modalMultipleProgressbar").modal({
            show: true,
            keyboard: false,
            remote: false
        });
    },
    hide: function () {
        this.$("#modalMultipleProgressbar").modal("hide");
        $(".modal-backdrop").remove();
        $("body").removeClass("modal-open");
    },
    isAnyProgressbarsVisible: function () {
        return this.collection.any(function (progressbar) {
            return progressbar.get("visible");
        }, this);
    },
    isAnyProgressbarsStarted: function () {
        return this.collection.any(function (progressbar) {
            return progressbar.get("enabled");
        }, this);
    },
    render: function () {
        var self = this;
        this.$el.html(this.template(this.model.toJSON()));

        if (this.isAnyProgressbarsVisible()) {
            this.collection.each(function (progressbar) {
                if (progressbar.get("visible") ||
                    progressbar.get("enabled")) {
                    self.$("#progressbars").append(
                        new BootstrapProgressbarView({ model: progressbar }).el
                    );
                } else {
                    self.$("#progressbars").append(
                        new BootstrapProgressbarUnknownStateView({ model: progressbar }).el
                    );
                }
            });
            this.show();

        } else if (this.isAnyProgressbarsStarted()) {
            this.hide();
            this.collection.each(function (progressbar) {
                progressbar.reset();
            });
        }

        return this;
    }
});


BootstrapProgressbarUnknownStateView = Backbone.View.extend({
    templateSelector: "#bootstrapProgressbarUnknownStateTemplate",
    template: null,
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.render();
    },
    render: function () {
        this.$el.empty().append(this.template(this.model.toJSON()));
    }
});


BootstrapProgressbarView = Backbone.View.extend({
    templateSelector: "#bootstrapProgressbarTemplate",
    template: null,
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.render();
    },
    render: function () {
        this.$el.empty().append(this.template(this.model.toJSON()));
    }
});
