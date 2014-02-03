define(["underscore", "backbone", "app", "app.book-history"]

    , function (_, Backbone, App, BookHistory) {
        "use strict";

        return Backbone.Router.extend({

                routes: { "library/books/:entityId": "showBook" },

                showBook: function (entityId) {
                    if (App.bookView.model) {
                        Backbone.stopListening(App.bookView.model.history);
                        Backbone.stopListening(App.bookView.model);
                    }
                    var book = App.library.get(entityId);
                    if (book) {
                        // TODO: How to include this in a more ... integrated way
                        if (!book.history) {
                            book.history = new BookHistory({ target: book });
                        }
                        App.bookView.model = book;
                        Backbone.listenTo(App.bookView.model, "change destroy", App.refreshCounts);
                        Backbone.listenTo(App.bookView.model, "change", _.bind(App.bookListView.render, App.bookListView));
                        App.bookView.render();

                    } else {
                        // Direct URL
                        throw new Error("Direct URL access is not yet implemented");
                    }
                }
            }
        )
    }
);
