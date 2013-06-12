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
                    var librarySummaryViewRendered = false,
                        libraryViewRendered = false;
                    app.libraryBookCountView = new app.LibraryBookCountView({ el: "#libraryBookCount", model: new app.BookCount() });

                    // Well, as a demo/for fun - doing things the veeery slow way ...
                    // Only applicable for > 1000 books
                    //app.libraryView = new app.LibraryView({ el: "#books", collection: new app.Library() });

                    // More performant version
                    //app.library.unshift(bookAndCount.book);

                    if (i < numberOfBooksToGenerate) {
                        app.libraryBookCountView.once("rendered", function () {
                            //librarySummaryViewRendered = true;
                            //if (libraryViewRendered) {
                            generateSingleRandomBook(++i);
                            //}
                        });
                        //app.libraryView.once("rendered", function () {
                        //    libraryViewRendered = true;
                        //    if (librarySummaryViewRendered) {
                        //        generateSingleRandomBook(++i);
                        //    }
                        //});
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
    var libraryBookCountView = app.libraryBookCountView = new app.LibraryBookCountView({ el: "#libraryBookCount", model: bookCount });
    var libraryBookListingView = app.libraryBookListingView = new app.LibraryBookListingView({ el: "#libraryBookListing", collection: library });
});
