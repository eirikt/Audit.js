var app = app || {};


app.GenerateRandomBookCommand = Backbone.Model.extend({
    urlRoot: "/api/admin/generate-single-random"
});

app.LibraryAdminView = Backbone.View.extend({
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
            var i = 1;
            var generateSingleRandomBook = function () {
                var xhr = new app.GenerateRandomBookCommand().save();
                if (xhr === false) {
                    alert("Server error!");
                }
                xhr.done(function (bookAndCount) {

                    // Well, as a demo/for fun - doing things in a DOM-abusing extremely slow way ...it's only writes anyway
                    // Only applicable for > 100 books (causes screen to flicker in Bootstrap setup)
                    var libraryBookCountViewRendered = false,
                        libraryBookListingViewRendered = false;

                    //app.libraryBookCountView.close();
                    app.libraryBookCountView = new app.LibraryBookCountView({ el: "#libraryBookCount", model: new app.BookCount() });

                    if (app.libraryBookListingView.isActive()) {
                        app.libraryBookListingView.close();
                        //app.libraryBookListingView = new app.LibraryBookListingView({ el: "#libraryBookListing", collection: new app.Library });
                        app.libraryBookListingView = new app.LibraryBookListingView({ collection: new app.Library() });
                        //app.libraryBookListingView.isDisabled = false;
                    } else {
                        libraryBookListingViewRendered = true;
                    }

                    // TODO: More performant version
                    //app.library.unshift(bookAndCount.book);

                    if (i < numberOfBooksToGenerate) {
                        app.libraryBookCountView.once("rendered", function () {
                            libraryBookCountViewRendered = true;
                            if (libraryBookListingViewRendered) {
                                generateSingleRandomBook(++i);
                            }
                        });
                        if (app.libraryBookListingView.isActive()) {
                            app.libraryBookListingView.once("rendered", function () {
                                window.setTimeout(function () {
                                    libraryBookListingViewRendered = true;
                                    if (libraryBookCountViewRendered) {
                                        generateSingleRandomBook(++i);
                                    }
                                }, 200);
                            });
                        }
                    }
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
    var bookCount = app.library = new app.BookCount();

    // Views
    var adminView = app.adminView = new app.LibraryAdminView({ el: "#libraryAdmin" }).render();
    var libraryBookCountView = app.libraryBookCountView =
        new app.LibraryBookCountView({ el: "#libraryBookCount", model: bookCount });
    //var libraryBookListingView = app.libraryBookListingView = new app.LibraryBookListingView({ el: "#libraryBookListing", collection: library });
    var libraryBookListingView = app.libraryBookListingView =
        new app.LibraryBookListingView({ collection: library });

    $("#bookListingAnchor").on("click", function (e) {
        e.preventDefault();
        //if (app.libraryBookListingView.isDisabled) {
        //    app.libraryBookListingView.close();
        //    app.libraryBookListingView = new app.LibraryBookListingView({ collection: new app.Library() });
        //    app.libraryBookListingView.isDisabled = false;
        //} else {
        //    app.libraryBookListingView.isDisabled = true;
        //}
        if (app.libraryBookListingView.isActive()) {
            //alert("isActive")
        } else {
            //alert("isNotActive")
            app.libraryBookListingView.close();
            app.libraryBookListingView =
                new app.LibraryBookListingView({ collection: new app.Library() });
        }
    });
});
