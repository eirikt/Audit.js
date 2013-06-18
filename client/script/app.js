var app = app || {};

app.GenerateRandomBookCommand = Backbone.Model.extend({
    urlRoot: "/api/admin/generate-single-random"
});

app.AdminView = Backbone.View.extend({
    templateSelector: "#adminTemplate",
    events: {
        "click #purge": "purgeAllBooks",
        "click #replay": "replayChangeLog",
        "click #generate": "generateRandomBooks"
    },
    render: function () {
        this.$el.empty().append($(this.templateSelector).html());
    },
    close: function () {
        alert("TODO: close");
    },
    purgeAllBooks: function () {
        alert("TODO: purgeAllBooks");
    },
    replayChangeLog: function () {
        alert("TODO: replayChangeLog");
    },
    generateRandomBooks: function () {
        var numberOfBooksToGenerate = parseInt(this.$("#numberOfBooksToGenerate").val());
        if (numberOfBooksToGenerate) {
            var i = 0;
            var generateSingleRandomBook = function () {
                i += 1;
                var xhr = new app.GenerateRandomBookCommand().save();
                if (xhr === false) {
                    alert("Server error!");
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

                    app.bookCount.set("count", bookAndCount.count);
                    app.library.push(bookAndCount.book);
                });
                xhr.fail(function () {
                    alert("FAIL!")
                });
            };
            // Instigate!
            generateSingleRandomBook();
        }
    }
});

$(function () {
    // When DOM is ready ...

    // Models
    var library = app.library = new app.Library();
    var bookCount = app.bookCount = new app.BookCount();

    // Views
    var adminView = app.adminView =
        new app.AdminView({ el: "#libraryAdmin" }).render();

    var bookCountView = app.bookCountView =
        new app.BookCountView({
            el: "#libraryBookCount",
            model: bookCount
        });

    var bookListingView = app.bookListingView =
        //new app.BookListingView({
        new app.BookListingTableView({
            el: "#libraryBookListing",
            collection: library
        });

    // DOM events: Toggle book listing
    $("#bookListingAnchor").on("click", function (e) {
        e.preventDefault();
        if (bookListingView.isActive()) {
            bookListingView.close();
        } else {
            library.fetch({ reset: true });
        }
    });
});
