/* global define:false, prettyprintInteger:false */
define(['jquery', 'underscore', 'backbone'],

    // TODO: Rename file to 'app.library-numbers-view.js'
    function ($, _, Backbone) {
        'use strict';

        var LibraryEntityCountModel = Backbone.Model.extend({
                defaults: {
                    count: 0
                },
                fetch: function () {
                    return Backbone.Model.prototype.fetch.call(this, {
                        type: 'POST',
                        url: this.url
                    });
                }
            }),
            LibraryEntityCountView = Backbone.View.extend({
                tagName: 'span',
                className: 'essential',
                template: _.template('' +
                    '<span><%= args.count %></span>',
                    { variable: 'args' }
                ),
                initialize: function () {
                    this.listenTo(this.model, 'sync change', this.render);
                },
                render: function () {
                    var model = this.model.toJSON();
                    model.count = prettyprintInteger(model.count);
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
                '  <span class="library-overview-heading">Books</span>' +
                '  <span class="library-overview-heading">Visits</span>' +
                '  <span class="library-overview-heading">Loans</span>' +
                '</div>' +
                '<div class="library-overview-row">' +
                '  <span id="bookCount" class="library-overview-element"></span>' +
                '  <span id="visitCount" class="library-overview-element"></span>' +
                '  <span id="loanCount" class="library-overview-element"></span>' +
                '</div>'
            ),

            bookCount: null,
            bookCountView: null,
            visitCount: null,
            visitCountView: null,

            initialize: function () {
                this.render();

                this.bookCount = new BookCount();
                this.bookCountView = new LibraryEntityCountView({ el: '#bookCount', model: this.bookCount });
                this.visitCount = new VisitCount();
                this.visitCountView = new LibraryEntityCountView({ el: '#visitCount', model: this.visitCount });
                this.loanCount = new LoanCount();
                this.loanCountView = new LibraryEntityCountView({ el: '#loanCount', model: this.loanCount });

                this.renderChildViews();
            },
            renderChildViews: function () {
                this.bookCount.fetch();
                this.visitCount.fetch();
                this.loanCount.fetch();
            },
            render: function () {
                this.$el.empty().append(this.template({}));
            }
        });
    }
);
