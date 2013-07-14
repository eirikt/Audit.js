var app = app || {};

// http://stackoverflow.com/questions/680241/resetting-a-multi-stage-form-with-jquery
function resetFormInputFields($form) {
    $form.find("input:text, input:password, input:file, select, textarea").val("");
    $form.find("input:radio, input:checkbox").removeAttr("checked").removeAttr("selected");
}

app.StateChangeCountQuery = Backbone.Model.extend({
    default: { totalCount: 0, createCount: 0, updateCount: 0, deleteCount: 0},
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
    //tagName:"div",
    //className:"clearfix",
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
        this.model.fetch({
            error: function (err) {
                alert(err);
            }
        });
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        this.trigger("rendered");
    },
    close: function () {
        alert("TODO: close");
    },
    purgeAllBooks: function () {
        var purgeAllBooksCommand = new app.PurgeAllBooksCommand();
        var xhr = purgeAllBooksCommand.save();
        if (xhr === false) {
            alert("Server error!");
        }
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
                            if (app.bookListingView.isActive()) {
                                if (libraryBookListingViewRendered) {
                                    generateSingleRandomBook();
                                }
                            } else {
                                generateSingleRandomBook();
                            }
                        });
                        if (app.bookListingView.isActive()) {
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

var AppRouter = Backbone.Router.extend({
    routes: { "book/:query": "showBook" },
    showBook: function (id) {
        var book = app.library.get(id);
        if (book) {
            app.bookView.model = book;
            app.bookView.render();
        }
    }
});

$(function () {
    // When DOM is ready ...

    // Models
    var stateChangeCount = app.stateChangeCount = new app.StateChangeCountQuery();
    var library = app.library = new app.Library();
    var bookCount = app.bookCount = new app.BookCountQuery();

    // Views
    var adminView = app.adminView = new app.AdminView({ el: "#libraryAdmin", model: stateChangeCount });
    var bookCountView = app.bookCountView = new app.BookCountView({ el: "#libraryBookCount", model: bookCount });
    var bookView = app.bookView = new app.BookView({ el: "#book" });
    var bookListingView = app.bookListingView =
        //new app.BookListingView({ el: "#libraryBookListing", collection: library });
        new app.BookListingTableView({ el: "#libraryBookListing", collection: library });

    // Update state change count and book count, book collection is up-to-date and only needs re-rendering
    var refresh = app.refresh = function () {
        stateChangeCount.fetch();
        bookCount.fetch();
        bookListingView.render();
    };

    // DOM events: Toggle book listing
    $("#bookListingAnchor").on("click", function (event) {
        event.preventDefault();
        if (bookListingView.isActive()) {
            bookListingView.close();
        } else {
            library.fetch({ reset: true });
        }
    });

    // Router listening for hash changes
    var appRouter = app.appRouter = new AppRouter();
    Backbone.history.start();
});
