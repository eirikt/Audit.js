/* global define: false */
define(["jquery", "underscore", "backbone",
        "backbone.simple-underscore-template-view", "backbone.timer"],

    function ($, _, Backbone, SimpleUnderscoreView, Timer) {
        "use strict";

        /**
         * Modal Bootstrap dialog with multiple progress bars, and a stopwatch showing the overall elapsed time.
         */
        return Backbone.View.extend({

            ProgressbarMetainfoView: Backbone.View.extend({
                tagName: 'div',
                className: 'tiny',
                template: _.template('' +
                    '<table>' +
                    '  <tr><td><span style="margin-right:1rem;">Total count:</span></td><td><strong><%= prettyprintInteger(totalCount) %></strong></td></tr>' +
                    '  <tr><td>Elapsed:</td><td><strong><%= elapsed %></strong></td></tr>' +
                    '  <tr><td>By user:</td><td><span style="color:grey;font-style:italic"><%= user %></span></td></tr>' +
                    '</table>'
                ),
                initialize: function () {
                    this.listenTo(this.model, "change", this.render);
                },
                render: function () {
                    this.$el.empty().append(this.template(this.model.toJSON()));
                    return this;
                }
            }),

            // TODO: fading in and out, http://stackoverflow.com/questions/7676356/can-twitter-bootstrap-alerts-fade-in-as-well-as-out
            template: _.template('' +
                '<div id="modalMultipleProgressbar" class="modal" style="margin-top:100px;" role="dialog">' +
                '  <div class="modal-dialog">' +
                '    <div class="important-looking centered modal-content">' +
                '      <div class="clearfix" style="margin:1.2rem;">' +
                '        <div id="progressbarMetainfo" class="pull-right"></div>' +
                '        <div><strong><%= headerText %></strong></div>' +
                '      </div>' +
                '      <div id="progressbars" style="margin-top:2rem;"></div>' +
                '      <div style="margin:2rem;text-align:center;">' +
                '        <span><%= footerText %></span>' +
                '      </div>' +
                '    </div>' +
                '  </div>' +
                '</div>'
            ),

            bootstrapProgressbarTemplate: _.template('' +
                '<div style="margin-left:1rem;">' +
                '  <small><%= headerText %></small>' +
                '</div>' +
                '<div class="progress" style="margin:1rem;">' +
                '  <span class="progress-bar progress-bar-info"' +
                '      role="progressbar"' +
                '      aria-valuemin="0"' +
                '      aria-valuenow="<%= progressValueInPercent %>"' +
                '      aria-valuemax="100"' +
                '      style="text-align:left;width:<%= progressValueInPercent %>%;">' +
                '    &nbsp;&nbsp;<%= Math.round(progressValueInPercent) %>&nbsp;%' +
                '  </span>' +
                '  <!--<span style="margin:1rem">Remaining: 80%</span>-->' +
                '</div>'
            ),

            unknownStateBootstrapProgressbarTemplate: _.template('' +
                '<div style="margin-left:1rem;">' +
                '  <small>' +
                '    <%= headerText %>' +
                '  </small>' +
                '</div>' +
                '<div class="progress" style="margin:1rem;">' +
                '  <span class="progress-bar progress-bar-info"' +
                '      role="progressbar"' +
                '      aria-valuemin="0"' +
                '      aria-valuenow="0"' +
                '      aria-valuemax="100"' +
                '      style="text-align:left;">' +
                '  </span>' +
                '  <span style="margin:1rem;font-size:x-small;text-align:center;">&nbsp;&nbsp;Unknown state ...</span>' +
                '</div>'
            ),

            setupDom: function () {
                this.$el.empty().append(this.template(this.model.toJSON()));
                this.$("#progressbarMetainfo").append(this.metaInfoView.el);
            },
            initialize: function () {
                //console.log("Multi-progressbar: initialize ...");
                this.timer = new Timer();

                this.metaInfoView = new this.ProgressbarMetainfoView({
                    model: this.timer
                });
                this.listenTo(this.model, "change", this.setupDom);
                this.listenTo(this.collection, "change", this.render);

                this.setupDom();

                $("body").prepend(this.render().el);
            },
            show: function () {
                //console.log("Multi-progressbar: show ...");
                this.$("#modalMultipleProgressbar").modal({
                    show: true,
                    backdrop: "static",
                    keyboard: false,
                    remote: false
                });
                if (!this.timer.isStarted()) {
                    console.log("NOT STARTED, starting with " + this.model.get("startTime"));
                    this.timer.start(this.model.get("startTime"), this.model.get("totalCount"));
                } else {
                    this.timer.set("totalCount", this.model.get("totalCount"));
                }
            },
            hide: function () {
                //console.log("Multi-progressbar: hide ...");
                this.$("#modalMultipleProgressbar").modal("hide");
                $(".modal-backdrop").remove();
                $("body").removeClass("modal-open");
                this.timer.stop();
                this.model.reset();
                this.collection.each(function (progressbar) {
                    progressbar.reset();
                });
            },
            areAnyProgressbarsActive: function () {
                return this.collection.any(function (progressbar) {
                    return progressbar.isActive();
                }, this);
            },
            areAllProgressbarsFinished: function () {
                return this.collection.all(function (progressbar) {
                    return progressbar.isFinished();
                }, this);
            },
            render: function () {
                //console.log("Multi-progressbar: render ...");
                var self = this;

                this.model.set("startTime", new Date().getTime(), { silent: true });
                this.$("#progressbars").empty();

                if (this.areAllProgressbarsFinished()) {
                    this.hide();

                } else if (this.areAnyProgressbarsActive()) {
                    this.collection.each(function (progressbar) {
                        var template = self.unknownStateBootstrapProgressbarTemplate;
                        if (progressbar.isActive()) {
                            template = self.bootstrapProgressbarTemplate;
                            if (progressbar.get("startTime") &&
                                progressbar.get("startTime") < self.model.get("startTime")) {

                                self.model.set("startTime", progressbar.get("startTime"), { silent: true });
                            }
                            if (progressbar.get("totalCount")) {
                                self.model.set("totalCount", progressbar.get("totalCount"), { silent: true });
                            }
                        }
                        self.$("#progressbars").append(
                            new SimpleUnderscoreView({
                                template: template,
                                model: progressbar
                            }).el
                        );
                    });
                    this.show();
                }
                else {
                    this.hide();

                }
                return this;
            }
        });
    }
);
