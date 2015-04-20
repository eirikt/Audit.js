/* global define:false */
define(["jquery", "underscore", "backbone", "app.book-view", "app.book-history-view"],

    function ($, _, Backbone, BookView, BookHistoryView) {
        "use strict";

        return Backbone.View.extend({
            model: null,
            bookView: null,
            bookHistoryView: null,

            isVisible: function () {
                return this.$el.parent("div").hasClass("in");
            },
            render: function () {
                // Show view if not already visible
                if (!this.isVisible()) {
                    $("#bookDetails").click();
                }
                // Recreate/refresh the composite views
                if (this.bookView) {
                    this.bookView.remove();
                }
                if (this.bookHistoryView) {
                    this.bookHistoryView.remove();
                }
                this.bookView = new BookView({ parentView: this, model: this.model });
                this.bookHistoryView = new BookHistoryView({ parentView: this, model: this.model });
                this.$el.empty().append(this.bookView.el).append(this.bookHistoryView.el);

                Backbone.listenTo(this.model, "destroy", _.bind(this.bookView.reset, this.bookView));
                Backbone.listenTo(this.model, "change destroy", _.bind(this.model.history.fetch, this.model.history, { reset: true }));
                Backbone.listenTo(this.model.history, "change", _.bind(this.bookView.render, this.bookView));
                Backbone.listenTo(this.model.history, "reset change", _.bind(this.bookHistoryView.render, this.bookHistoryView));

                // Render the composite views
                this.bookView.render();
                this.model.history.fetch({ reset: true });
            },
            reset: function () {
                if (this.bookView) {
                    this.bookView.reset();
                }
                if (this.bookHistoryView) {
                    this.bookHistoryView.reset();
                }
            }
        });
    }
);
