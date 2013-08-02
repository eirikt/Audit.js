var app = app || {};

app.StateChangeCountQuery = Backbone.Model.extend({
    default: { totalCount: 0, createCount: 0, updateCount: 0, deleteCount: 0 },
    url: "/api/admin/statechangecount"
});

app.PurgeAllBooksCommand = Backbone.Model.extend({
    urlRoot: "/api/admin/purge"
});

app.ReplayChangeLogCommand = Backbone.Model.extend({
    urlRoot: "/api/admin/replay"
});

app.GenerateRandomBookCommand = Backbone.Model.extend({
    urlRoot: "/api/admin/generate-single-random"
});

app.AdminView = Backbone.View.extend({
    templateSelector: "#adminTemplate",
    template: null,
    events: {
        "click #purge": "purgeAllBooks",
        "click #replay": "replayChangeLog",
        "click #generate": "generateRandomBooks"
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
    },
    generateRandomBooks: function () {
        var numberOfBooksToGenerate = parseInt(this.$("#numberOfBooksToGenerate").val());
        // TODO: replace this with server-push
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
                    app.bookCount.set("count", bookAndCount.count);
                    app.library.push(bookAndCount.book);
                });
                xhr.fail(function (error) {
                    alert("Server failure: " + error);
                });
            };
            // Instigate!
            generateSingleRandomBook();
        }
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
            // TODO: Consider moving this init logic into 'Backbone.Audit.History' mix-in
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

$(function () {
    // When DOM is ready ...

    // Models
    app.stateChangeCount = new app.StateChangeCountQuery();
    app.bookCount = new app.BookCountQuery();
    app.library = new app.Library();

    // Views
    app.adminView = new app.AdminView({ el: "#libraryAdmin", model: app.stateChangeCount });
    app.bookCountView = new app.BookCountView({ el: "#libraryBookCount", model: app.bookCount });
    app.bookView = new app.BookCompositeView({ el: "#book" });
    app.bookListingView =
        //new app.BookListingSimpleView({ el: "#libraryBookListing", collection: app.library });
        new app.BookListingTableView({ el: "#libraryBookListing", collection: app.library });

    // Update state change count and book count
    app.refreshCounts = function () {
        app.stateChangeCount.fetch();
        app.bookCount.fetch();
    };

    // DOM events: Toggle book listing
    $("#bookListingAnchor").on("click", function (event) {
        event.preventDefault();
        if (app.bookListingView.isVisible()) {
            app.bookListingView.close();
        } else {
            app.library.fetch({ reset: true });
        }
    });

    // Router listening for hash changes
    app.appRouter = new app.AppRouter();
    Backbone.history.start();
});
