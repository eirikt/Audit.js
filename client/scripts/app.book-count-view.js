/* global define:false, prettyprintInt:false */

define(['jquery', 'underscore', 'backbone'],

    // TODO: Rename file to 'app.library-numbers-view.js'
    function ($, _, Backbone) {
        'use strict';

        var LibraryEntityCountModel = Backbone.Model.extend({
                defaults: {
                    count: 0
                }
            }),
            LibraryEntityUnknownCountView = Backbone.View.extend({
                tagName: 'span',
                className: 'wage x-large',
                render: function () {
                    this.$el.append('?');
                    return this;
                }
            }),
            LibraryEntityCountView = Backbone.View.extend({
                tagName: 'span',
                className: 'strong x-large',
                template: _.template('<%= args.count %>', { variable: 'args' }),
                initialize: function () {
                    this.listenTo(this.model, 'sync change', this.render);
                },
                render: function () {
                    var model = this.model.toJSON();
                    model.count = prettyprintInt(model.count);
                    this.$el.empty().append(this.template(model));
                }
            }),

            BookCount = LibraryEntityCountModel.extend({
                url: '/library/books/count'
            }),
            VisitCount = LibraryEntityCountModel.extend({
                url: '/library/visits/count'
            }),
            LoanCount = LibraryEntityCountModel.extend({
                url: '/library/loans/count'
            });

        return Backbone.View.extend({
            tagName: 'div',
            className: 'library-overview',
            template: _.template('' +
                '<div class="library-overview-row">' +
                '  <span class="library-overview-heading"><em>Books</em></span>' +
                '  <span class="library-overview-heading"><em>Visits</em></span>' +
                '  <span class="library-overview-heading"><em>Loans</em></span>' +
                '</div>' +
                '<div class="library-overview-row">' +
                '  <span id="bookCount" class="library-overview-element"></span>' +
                '  <span id="visitCount" class="library-overview-element"></span>' +
                '  <span id="loanCount" class="library-overview-element"></span>' +
                '</div>'
            ),
            bookCount: null,
            visitCount: null,
            loanCount: null,

            loanCountView: null,
            bookCountView: null,
            visitCountView: null,

            initialize: function () {
                this.render();

                this.bookCount = new BookCount();
                this.visitCount = new VisitCount();
                this.loanCount = new LoanCount();

                this.bookCountView = new LibraryEntityCountView({ model: this.bookCount });
                this.visitCountView = new LibraryEntityCountView({ model: this.visitCount });
                this.loanCountView = new LibraryEntityCountView({ model: this.loanCount });

                this.renderChildViews();
            },

            renderChildViews: function () {
                $('#bookCount').empty().append(this.bookCountView.el);
                $('#visitCount').empty().append(this.visitCountView.el);
                $('#loanCount').empty().append(this.loanCountView.el);

                this.bookCount.save(null, {
                    error: function () {
                        $('#bookCount').empty().append(new LibraryEntityUnknownCountView().render().el);
                    }
                });
                this.visitCount.save(null, {
                    error: function () {
                        $('#visitCount').empty().append(new LibraryEntityUnknownCountView().render().el);
                    }
                });
                this.loanCount.save(null, {
                    error: function () {
                        $('#loanCount').empty().append(new LibraryEntityUnknownCountView().render().el);
                    }
                });
            },

            render: function () {
                this.$el.empty().append(this.template());
            }
        });
    }
);
