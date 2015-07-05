/* global define: false, prettyprintInt: false */
/* jshint -W031 */

define(['underscore', 'backbone',
        'app', 'backbone.progressbar', 'backbone.bootstrap.multi-progressbar-view'],

    function (_, Backbone, App, Progressbar, BootstrapModalMultipleProgressbarView) {
        'use strict';

        var CqrsCheck = Backbone.Model.extend({
            url: '/cqrs/status'
        });
        var CqrsToggle = Backbone.Model.extend({
            url: '/cqrs/toggle'
        });
        var EventStoreReplay = Backbone.Model.extend({
            url: '/events/replay'
        });
        var ProgressbarCollection = Backbone.Collection.extend({
            model: Progressbar
        });

        return Backbone.View.extend({
            template: _.template('' +
                '<div class="row" style="margin-left:.1rem;">' +
                '  <span>' +
                '    Total number of state change events:&nbsp;<strong><%= totalCount %></strong>&nbsp;&nbsp;&nbsp;' +
                '    <small>' +
                '      CREATE:&nbsp;<%= createCount %>&nbsp;&nbsp;&nbsp;&nbsp;' +
                '      UPDATE:&nbsp;<%= updateCount %>&nbsp;&nbsp;&nbsp;&nbsp;' +
                '      DELETE:&nbsp;<%= deleteCount %>' +
                '    </small>' +
                '  </span>' +
                '</div>' +
                '<div class="row" style="margin-left:.1rem;margin-top:1rem;">' +
                '  <span>' +
                '    <button id="toggleCqrs" class="btn">?</button>' +
                '  </span>' +
                '  <span>' +
                '    <button id="replay" class="btn btn-info">Replay all state change events</button>' +
                '  </span>' +
                '</div>'
                // TODO: aus der reihe ...
                //'<div class="row" style="margin-left: .1rem;margin-top: 1rem;">' +
                //'  <span><button class="btn">Local storage</button></span>' +
                //'  <span><button class="btn">Sync data</button></span>' +
                //'</div>' +
            ),
            events: {
                'click #toggleCqrs': 'toggleCqrs',
                'click #replay': 'replayChangeLog'
            },
            cqrsActive: null,

            initialize: function () {
                var mapreduceProgressbar = new Progressbar({
                    headerText: 'Map-reducing all state change events ... ' +
                    '<span class="pull-right" style="margin-right:1rem;"><small><em>event store</em></small></span>'
                });
                mapreduceProgressbar.listenTo(App.pushClient, 'mapreducing-events', mapreduceProgressbar.start);
                mapreduceProgressbar.listenTo(App.pushClient, 'event-mapreduced', mapreduceProgressbar.progress);
                mapreduceProgressbar.listenTo(App.pushClient, 'all-events-mapreduced', mapreduceProgressbar.finish);

                var replayProgressbar = new Progressbar({
                    headerText: 'Creating book objects (if not already created) ... ' +
                    '<span class="pull-right" style="margin-right:1rem;"><em><small>event store </small>&rArr;<small> application stores</small></em></span>'
                });
                replayProgressbar.listenTo(App.pushClient, 'replaying-events', replayProgressbar.start);
                replayProgressbar.listenTo(App.pushClient, 'event-replayed', replayProgressbar.progress);
                replayProgressbar.listenTo(App.pushClient, 'all-events-replayed', replayProgressbar.finish);

                new BootstrapModalMultipleProgressbarView({
                    model: new Progressbar({
                        headerText: 'Replaying all state change events into application stores ...'
                    }),
                    collection: new ProgressbarCollection([mapreduceProgressbar, replayProgressbar])
                });

                this.listenTo(App.pushClient, 'cqrs', this.renderButtons);
                this.listenTo(this.model, 'change', this.render);

                this.model.fetch();
                this.render(); // Needed if no data
            },

            render: function () {
                var model = this.model.toJSON();
                model.totalCount = prettyprintInt(model.totalCount);
                model.createCount = prettyprintInt(model.createCount);
                model.updateCount = prettyprintInt(model.updateCount);
                model.deleteCount = prettyprintInt(model.deleteCount);
                this.$el.empty().append(this.template(model));
                this.checkCqrs();
            },

            renderButtons: function (usingCqrs) {
                if (usingCqrs) {
                    this.cqrsActive = true;
                    this.$('#toggleCqrs').removeClass('btn-warning').addClass('btn-success').empty().append('CQRS ON');
                    this.$('#replay').removeClass('disabled').attr('title', '');
                } else {
                    this.cqrsActive = false;
                    this.$('#toggleCqrs').addClass('btn-warning').removeClass('btn-success').empty().append('CQRS OFF');
                    this.$('#replay').addClass('disabled').attr('title', 'N/A as CQRS is disabled');
                }
            },

            checkCqrs: function () {
                new CqrsCheck().fetch().done(_.bind(this.renderButtons, this));
            },

            toggleCqrs: function () {
                // TODO: consider introducing CQRS threshold warning ('modal conditional alert dialog'), e.g. at ~20000
                new CqrsToggle().save();
            },

            replayChangeLog: function (event) {
                if (this.cqrsActive) {
                    new EventStoreReplay().save();

                } else {
                    event.preventDefault();
                }
            }
        });
    }
);
