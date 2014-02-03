define([
    "underscore", "backbone",
    "app", "app.server-push-client", "backbone.progressbar", "backbone.bootstrap.multi-progressbar-view"
]
    , function (_, Backbone, App, Progressbar, BootstrapModalMultipleProgressbarView) {
        "use strict";

        var CqrsCheck = Backbone.Model.extend({
            url: "/events/cqrs/status"
        });

        var CqrsToggle = Backbone.Model.extend({
            url: "/events/cqrs/toggle"
        });

        var EventStoreReplay = Backbone.Model.extend({
            url: "/events/replay"
        });

        var ProgressbarCollection = Backbone.Collection.extend({
            model: Progressbar
        });

        return Backbone.View.extend({
            // Get rid of the top div as well ...
            template: _.template('<div class="row" style="margin-left:.1rem;">' +
                '<span>' +
                '  Total number of state change events:&nbsp;<strong><%= totalCount %></strong>&nbsp;&nbsp;&nbsp;' +
                '  <small>' +
                '    CREATE:&nbsp;<%= createCount %>&nbsp;&nbsp;&nbsp;&nbsp;' +
                '    UPDATE:&nbsp;<%= updateCount %>&nbsp;&nbsp;&nbsp;&nbsp;' +
                '    DELETE:&nbsp;<%= deleteCount %>' +
                '  </small>' +
                '</span>' +
                '</div>' +
                '<div class="row" style="margin-left:.1rem;margin-top:1rem;">' +
                '  <span>' +
                '    <button id="toggleCqrs" class="btn">?</button>' +
                '  </span>' +
                '  <span>' +
                '    <button id="replay" class="btn btn-info">Replay all state change events</button>' +
                '  </span>' +
                '</div>'
                //'<div class="row" style="margin-left: .1rem;margin-top: 1rem;">' +
                //'  <span><button class="btn">Local storage</button></span>' +
                //'  <span><button class="btn">Sync data</button></span>' +
                //'</div>' +
            ),
            events: {
                "click #toggleCqrs": "toggleCqrs",
                "click #replay": "replayChangeLog"
            },
            cqrsActive: null,

            initialize: function () {
                var replayStateChangeEventsProgressbar = new Progressbar({ headerText: "Replaying all state change events into application store ..." });
                //replayStateChangeEventsProgressbar.listenTo(app.pushClient, "replaying-events", replayStateChangeEventsProgressbar.reset);

                var replayProgressbar = new Progressbar();
                replayProgressbar.listenTo(App.pushClient, "replaying-events", replayProgressbar.start);
                replayProgressbar.listenTo(App.pushClient, "event-replayed", replayProgressbar.progress);
                replayProgressbar.listenTo(App.pushClient, "all-events-replayed", replayProgressbar.finish);

                new BootstrapModalMultipleProgressbarView({
                    model: replayStateChangeEventsProgressbar,
                    collection: new ProgressbarCollection([replayProgressbar])
                });
                this.listenTo(App.pushClient, "cqrs", this.renderButtons);
                this.listenTo(this.model, "sync change", this.render);
                this.model.fetch();
            },
            render: function () {
                var model = this.model.toJSON();
                model.totalCount = prettyprintInteger(model.totalCount);
                model.createCount = prettyprintInteger(model.createCount);
                model.updateCount = prettyprintInteger(model.updateCount);
                model.deleteCount = prettyprintInteger(model.deleteCount);
                this.$el.html(this.template(model));
                this.checkCqrs();
            },
            renderButtons: function (usingCqrs) {
                if (usingCqrs) {
                    this.cqrsActive = true;
                    this.$("#toggleCqrs").removeClass("btn-warning").addClass("btn-success").empty().append("CQRS ON");
                    this.$("#replay").removeClass("disabled").attr("title", "");
                } else {
                    this.cqrsActive = false;
                    this.$("#toggleCqrs").addClass("btn-warning").removeClass("btn-success").empty().append("CQRS OFF");
                    this.$("#replay").addClass("disabled").attr("title", "N/A as CQRS is disabled");
                }
            },
            checkCqrs: function () {
                new CqrsCheck().fetch().done(_.bind(this.renderButtons, this));

                // TODO: try ...
                //new Backbone.Model({ url: "/events/cqrs/status" })
                //    .fetch()
                //    .done(_.bind(this.renderButtons, this));
            },
            toggleCqrs: function () {
                // TODO: consider introducing CQRS threshold warning ('modal conditional alert dialog'), e.g. 20000
                new CqrsToggle().save();
            },
            replayChangeLog: function (event) {
                if (this.cqrsActive) {
                    new EventStoreReplay().save();

                } else {
                    event.preventDefault();
                }
            }
        })
    }
);
