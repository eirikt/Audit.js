var app = app || {};

app.StateChangeCountQuery = Backbone.Model.extend({
    default: { totalCount: 0, createCount: 0, updateCount: 0, deleteCount: 0 },
    url: "/api/admin/statechangecount"
});

app.GenerateRandomBookCommand = Backbone.Model.extend({
    urlRoot: "/api/admin/generate-single-random"
});

app.PurgeAllBooksCommand = Backbone.Model.extend({
    urlRoot: "/api/admin/purge"
});

app.ReplayChangeLogCommand = Backbone.Model.extend({
    urlRoot: "/api/admin/replay"
});

app.AdminView = Backbone.View.extend({
    templateSelector: "#adminTemplate",
    template: null,
    events: {
        "click #generate": "generateRandomBooks",
        "click #purge": "purgeAllBooks",
        "click #replay": "replayChangeLog"
    },
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.model, "change", this.render);
        this.model.fetch();
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        this.trigger("rendered");
    },
    generateRandomBooks: function () {
        var numberOfBooksToGenerate = parseInt(this.$("#numberOfBooksToGenerate").val());
        if (numberOfBooksToGenerate) {
            var i = 0;
            var generateSingleRandomBook = function () {
                i += 1;
                var xhr = new app.GenerateRandomBookCommand().save();
                if (xhr === false) {
                    alert("Unspecified server error!");
                }
                xhr.done(function (bookAndCount) {
                    var libraryBookCountViewRendered = false,
                        libraryBookListingViewRendered = false;

                    if (i < numberOfBooksToGenerate) {
                        app.bookCountView.once("rendered", function () {
                            libraryBookCountViewRendered = true;
                            if (app.bookListingView.isVisible()) {
                                if (libraryBookListingViewRendered) {
                                    generateSingleRandomBook();
                                }
                            } else {
                                generateSingleRandomBook();
                            }
                        });
                        if (app.bookListingView.isVisible()) {
                            app.bookListingView.once("bookRendered", function () {
                                libraryBookListingViewRendered = true;
                                if (libraryBookCountViewRendered) {
                                    generateSingleRandomBook();
                                }
                            });
                        }
                    }
                    app.stateChangeCount.set({
                        "totalCount": bookAndCount.stateChangeCount,
                        "createCount": bookAndCount.stateChangeCreateCount,
                        "updateCount": bookAndCount.stateChangeUpdateCount,
                        "deleteCount": bookAndCount.stateChangeDeleteCount
                    });
                    app.bookCount.set("count", bookAndCount.bookCount);
                    app.library.push(bookAndCount.book);
                });
                xhr.fail(function (error) {
                    alert("Server failure: " + error);
                });
            };
            // Instigate!
            generateSingleRandomBook();
        }
    },
    purgeAllBooks: function () {
        var purgeAllBooksCommand = new app.PurgeAllBooksCommand();
        var xhr = purgeAllBooksCommand.save();
        if (xhr === false) {
            alert("Server error!");
        }
        // TODO: Get .done working and us it
        //xhr.done(function () {
        //    alert("DONE!")
        //});
        //xhr.fail(function () {
        //    alert("FAIL!")
        //});
        xhr.always(function (data_or_jqXHR, textStatus, jqXHR_or_errorThrown) {
            app.bookCount.set("count", 0);
            app.library.reset();
        });
    },
    replayChangeLog: function () {
        var replayChangeLogCommand = new app.ReplayChangeLogCommand();
        var xhr = replayChangeLogCommand.save();
        if (xhr === false) {
            alert("Server error!");
        }
        xhr.always(function () {
            app.bookCount.fetch();
            app.library.fetch();
        });
    }
});


app.AppRouter = Backbone.Router.extend({
    routes: { "book/:query": "showBook" },
    showBook: function (id) {
        if (app.bookView.model) {
            Backbone.stopListening(app.bookView.model.history);
            Backbone.stopListening(app.bookView.model);
        }
        var book = app.library.get(id);
        if (book) {
            // TODO: How to include this in a more ... integrated way
            if (!book.history) {
                book.history = new app.BookHistory({ target: book });
            }
            app.bookView.model = book;
            Backbone.listenTo(app.bookView.model, "change destroy", app.refreshCounts);
            Backbone.listenTo(app.bookView.model, "change", _.bind(app.bookListingView.render, app.bookListingView));
            app.bookView.render();

        } else {
            // Direct URL
            throw new Error("Direct URL access is not yet implemented");
        }
    }
});


// When DOM is ready ...
$(function () {

    // Models
    app.stateChangeCount = new app.StateChangeCountQuery();
    app.bookCount = new app.BookCountQuery();
    app.library = new app.Library();

    // On demand: Update state change count and book count
    app.refreshCounts = function () {
        app.stateChangeCount.fetch();
        app.bookCount.fetch();
    };


    // Views
    app.adminView = new app.AdminView({ el: "#libraryAdmin", model: app.stateChangeCount });
    app.bookCountView = new app.BookCountView({ el: "#libraryBookCount", model: app.bookCount });
    app.bookView = new app.BookCompositeView({ el: "#book" });
    app.bookListingView = new app.BookListingTableView({ el: "#libraryBookListing", collection: app.library });

    // DOM events: Toggle book listing
    $("#bookListingAnchor").on("click", function (event) {
        event.preventDefault();
        if (app.bookListingView.isVisible()) {
            app.bookListingView.close();
        } else {
            app.library.fetch({ reset: true });
        }
    });


    // Start listening for URI hash changes
    app.appRouter = new app.AppRouter();
    Backbone.history.start();


    // HTTP server push events
    var socket = io.connect('http://localhost:4711');

    // Push event: Book added
    socket.on("book-added", function (bookAndCounts) {
        app.stateChangeCount.set({
            "totalCount": bookAndCounts.stateChangeCount,
            "createCount": bookAndCounts.stateChangeCreateCount,
            "updateCount": bookAndCounts.stateChangeUpdateCount,
            "deleteCount": bookAndCounts.stateChangeDeleteCount
        });
        app.bookCount.set("count", bookAndCounts.bookCount);
        app.library.push(bookAndCounts.book);
    });

    // Push event: Book updated
    socket.on("book-updated", function (updatedBook) {
        app.library.set(updatedBook, { add: false, remove: false, merge: true });

        if (app.bookView.model && app.bookView.model.id === updatedBook[app.Book.prototype.idAttribute]) {
            app.bookView.bookView.render();
        }

        app.refreshCounts();
    });

    // Push event: Book removed
    socket.on("book-removed", function (entityIdOfRemovedBook) {
        app.library.remove(app.library.get(entityIdOfRemovedBook));

        if (app.bookView.model && app.bookView.model.id === entityIdOfRemovedBook) {
            app.bookView.reset();
        }

        app.refreshCounts();
    });
});
