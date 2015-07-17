/* global define: false, prettyprintInt: false */

define(['underscore', 'backbone',
        'app', 'backbone.progressbar', 'backbone.bootstrap.multi-progressbar-view'],

    function (_, Backbone, App, Progressbar, BootstrapModalMultipleProgressbarView) {
        'use strict';

        var post = function (resource, body) {
                var ResourcePoster = Backbone.Model.extend({
                    url: resource
                });
                if (body) {
                    new ResourcePoster().save(body);
                } else {
                    new ResourcePoster().save();
                }
            },

            ProgressbarCollection = Backbone.Collection.extend({
                model: Progressbar
            });


        return Backbone.View.extend({
            tagName: 'div',
            className: 'row',
            template: _.template('' +
                '<div class="col-xs-5">' +
                '  <div class="input-group">' +
                '    <input id="numberOfBooksToGenerate" type="text" class="form-control" placeholder="how many?" maxlength="6" style="text-align: right"/>' +
                '    <span class="input-group-btn">' +
                '      <button id="generateBooks" class="btn btn-success">Generate books</button>' +
                '    </span>' +
                '  </div>' +
                '</div>' +

                '<div class="col-xs-2">' +
                '  <span>' +
                '    <button id="generateVisitsAndLoans" class="btn btn-success">Generate visits and loans</button>' +
                '  </span>' +
                '</div>' +

                '<div class="col-xs-5">' +
                '  <span>' +
                '    <button id="removeAllBooks" class="btn btn-danger pull-right">Clean books</button>' +
                '  </span>' +
                '</div>'
            ),

            events: {
                'click #generateBooks': 'generateRandomBooks',
                'click #generateVisitsAndLoans': 'generateRandomLibraryVisitsAndBookLoans',
                'click #removeAllBooks': 'removeAllBooks'
            },


            booksProgressbar: null,
            visitsAndLoansProgressbar: null,

            booksProgressbarView: null,
            visitsProgressbarView: null,


            initialize: function () {
                this.booksProgressbar = new Progressbar();
                Backbone.listenTo(App.pushClient, 'creating-book-statechangeevents', _.bind(this.booksProgressbar.start, this.booksProgressbar));
                Backbone.listenTo(App.pushClient, 'book-statechangeevent-created', _.bind(this.booksProgressbar.progress, this.booksProgressbar));
                Backbone.listenTo(App.pushClient, 'all-book-statechangeevents-created', _.bind(this.booksProgressbar.finish, this.booksProgressbar));

                this.booksProgressbarView = new BootstrapModalMultipleProgressbarView({
                    model: new Progressbar({
                        headerText: 'Generating random books ...'
                    }),
                    collection: new ProgressbarCollection([this.booksProgressbar])
                });

                this.visitsAndLoansProgressbar = new Progressbar();
                Backbone.listenTo(App.pushClient, 'creating-visit-statechangeevents', _.bind(this.visitsAndLoansProgressbar.start, this.visitsAndLoansProgressbar));
                Backbone.listenTo(App.pushClient, 'visit-statechangeevent-created', _.bind(this.visitsAndLoansProgressbar.progress, this.visitsAndLoansProgressbar));
                Backbone.listenTo(App.pushClient, 'all-visit-statechangeevents-created', _.bind(this.visitsAndLoansProgressbar.finish, this.visitsAndLoansProgressbar));

                this.visitsProgressbarView = new BootstrapModalMultipleProgressbarView({
                    model: new Progressbar({
                        headerText: 'Generating random library visits and book loans ...'
                    }),
                    collection: new ProgressbarCollection([this.visitsAndLoansProgressbar])
                });

                this.render();
            },


            render: function () {
                this.$el.html(this.template());
                return this;
            },


            generateRandomBooks: function () {
                console.log('generateRandomBooks(' + this.$('#numberOfBooksToGenerate').val() + ') ...');

                var numberOfBooksToGenerate = this.$('#numberOfBooksToGenerate').val();
                if (numberOfBooksToGenerate) {
                    var GenerateRandomBooks = Backbone.Model.extend({
                        url: '/library/books/generate'
                    });
                    new GenerateRandomBooks().save({ numberOfBooks: parseInt(numberOfBooksToGenerate, 10) });

                    this.booksProgressbar.set(
                        'headerText',
                        'Creating ' + prettyprintInt(numberOfBooksToGenerate) +
                        ' state change event objects for book entities ... ' +
                        '<span class="pull-right" style="margin-right:1rem;"><small><em>event store</em></small></span>',
                        { silent: true }
                    );

                } else {
                    numberOfBooksToGenerate = 0;
                }
            },


            generateRandomLibraryVisitsAndBookLoans: function () {
                console.log('generateRandomLibraryVisitsAndBookLoans() ...');

                this.visitsAndLoansProgressbar.set(
                    'headerText',
                    'Creating visits and loans state change event objects ... ' +
                    '<span class="pull-right" style="margin-right:1rem;"><small><em>event store</em></small></span>',
                    { silent: true }
                );

                post('/library/loans/generate');
            },


            removeAllBooks: function () {
                post('/library/books/clean');
            }
        });
    }
);
