define([
    "jquery", "underscore", "backbone",
    "app",
    "backbone.simple-underscore-template-view", "backbone.moment.stopwatch"
]

    /**
     * Modal Bootstrap dialog with multiple progress bars, and a stopwatch showing the overall elapsed time.
     */
    , function ($, _, Backbone, App, SimpleUnderscoreView, Stopwatch) {
        "use strict";

        // TODO: fading in and out, http://stackoverflow.com/questions/7676356/can-twitter-bootstrap-alerts-fade-in-as-well-as-out
        // TODO: include outer div in Backbone view
        var template = _.template('' +
            '<div id="modalMultipleProgressbar" class="modal" style="margin-top:100px;" role="dialog">' +
            '<div class="modal-dialog">' +
            '  <div class="important-looking centered modal-content">' +
            '    <div class="clearfix" style="margin:1.2rem;">' +
            '      <div id="progressbarMetainfo" class="pull-right"></div>' +
            '        <div><strong><%= headerText %></strong></div>' +
            '      </div>' +
            '      <div id="progressbars" style="margin-top:2rem;"></div>' +
            '      <div style="margin:1.2rem;text-align:center;">' +
            '        <span><%= footerText %></span>' +
            '      </div>' +
            '    </div>' +
            '  </div>' +
            '</div>'
        );

        var bootstrapProgressbarTemplate = _.template('' +
            '<div style="margin-left:1rem;">' +
            '  <small><%= headerText %></small>' +
            '</div>' +
            '<div class="progress" style="margin:1rem">' +
            '  <span class="progress-bar progress-bar-info"' +
            '      role="progressbar"' +
            '      aria-valuenow="<%= progressValueInPercent %>"' +
            '      aria-valuemin="0"' +
            '      aria-valuemax="100"' +
            '      style="text-align:left;width:<%= progressValueInPercent %>%;">' +
            '    &nbsp;&nbsp;<%= Math.round(progressValueInPercent) %>&nbsp;%' +
            '  </span>' +
            '  <!--<span style="margin:1rem">Remaining: 80%</span>-->' +
            '</div>'
        );

        var bootstrapProgressbarUnknownStateTemplate = _.template('' +
            '<div style="margin-left:1rem;">' +
            '  <small>' +
            '    <%= headerText %>' +
            '  </small>' +
            '</div>' +
            '<div class="progress" style="margin:1rem;">' +
            '  <span class="progress-bar progress-bar-info"' +
            '      role="progressbar"' +
            '      aria-valuenow="0"' +
            '      aria-valuemin="0"' +
            '      aria-valuemax="100"' +
            '      style="text-align:left;">' +
            '  </span>' +
            '  <span style="margin:1rem;font-size:x-small;text-align:center;">&nbsp;&nbsp;Unknown state ...</span>' +
            '</div>'
        );

        return Backbone.View.extend({
            //templateSelector: "#bootstrapModalMultipleProgressbarTemplate",

            ProgressbarMetainfoView: Backbone.View.extend({
                className: "tiny",
                template: _.template("<table>" +
                    "  <tr><td><span style='margin-right:1rem;'>Total count:</span></td><td><strong><%= prettyprintInteger(totalCount) %></strong></td></tr>" +
                    "  <tr><td>Elapsed:</td><td><strong><%= elapsed %></strong></td></tr>" +
                    "  <tr><td>By user:</td><td><span style='color:grey;font-style:italic'><%= user %></span></td></tr>" +
                    "</table>"
                ),
                initialize: function () {
                    this.listenTo(this.model, "change", this.render);
                },
                render: function () {
                    this.$el.empty().append(this.template(this.model.toJSON()));
                    return this;
                }
            }),

            setupDom: function () {
                //this.$el.empty().append(_.template($(this.templateSelector).html())(this.model.toJSON()));
                this.$el.empty().append(template(this.model.toJSON()));
                this.$("#progressbarMetainfo").append(this.metaInfoView.el);
            },
            initialize: function () {
                this.stopwatch = new Stopwatch();
                this.stopwatch.listenTo(App.pushClient, "replaying-events", this.stopwatch.stop);

                this.metaInfoView = new this.ProgressbarMetainfoView({
                    model: this.stopwatch
                });
                this.listenTo(this.model, "change", this.setupDom);
                this.listenTo(this.collection, "change", this.render);

                this.setupDom();

                $("body").prepend(this.render().el);
            },
            show: function () {
                this.$("#modalMultipleProgressbar").modal({
                    show: true,
                    backdrop: "static",
                    keyboard: false,
                    remote: false
                });
                if (!this.stopwatch.isStarted()) {
                    console.log("NOT STARTED, starting with " + this.model.get("startTime"));
                    this.stopwatch.start(this.model.get("startTime"), this.model.get("totalCount"));
                }
            },
            hide: function () {
                this.$("#modalMultipleProgressbar").modal("hide");
                $(".modal-backdrop").remove();
                $("body").removeClass("modal-open");
                this.stopwatch.stop();
                this.model.reset();
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
                var self = this;
                this.model.set("startTime", new Date().getTime(), { silent: true });
                this.$("#progressbars").empty();
                if (this.areAnyProgressbarsVisible()) {
                    this.collection.each(function (progressbar) {
                        if (progressbar.get("visible") || progressbar.get("enabled")) {
                            self.$("#progressbars").append(
                                new SimpleUnderscoreView({
                                    //templateSelector: "#bootstrapProgressbarTemplate",
                                    template: bootstrapProgressbarTemplate,
                                    model: progressbar
                                }).el
                            );
                            if (progressbar.get("startTime") != null &&
                                progressbar.get("startTime")
                                    < self.model.get("startTime")) {
                                self.model.set("startTime", progressbar.get("startTime"), { silent: true });
                            }
                            if (progressbar.get("totalCount") != null) {
                                self.model.set("totalCount", progressbar.get("totalCount"), { silent: true });
                            }

                        } else {
                            self.$("#progressbars").append(
                                new SimpleUnderscoreView({
                                    //templateSelector: "#bootstrapProgressbarUnknownStateTemplate",
                                    template: bootstrapProgressbarUnknownStateTemplate,
                                    model: progressbar
                                }).el
                            );
                        }
                    });
                    this.show();

                } else if (this.areAnyProgressbarsStarted()) {
                    this.hide();
                    this.collection.each(function (progressbar) {
                        progressbar.reset();
                    });
                }
                return this;
            }
        });
    }
);
