var app = app || {};


app.LibraryAdminView = Backbone.View.extend({
    templateEl: "#adminTemplate",
    events: {
        "click #purge": "purgeAllBooks",
        "click #replay": "replayChangeLog",
        "click #generate": "generateRandomBooks"
    },
    render: function () {
        this.$el.empty().append($(this.templateEl).html());
    },
    purgeAllBooks: function () {
        alert("purgeAllBooks");
    },
    replayChangeLog: function () {
        alert("replayChangeLog");
    },
    generateRandomBooks: function () {
        alert("generateRandomBooks");
    }
});

$(function () {
    var library = app.library = new app.Library();
    var bookCount = app.library = new app.BookCount();
    var adminView = app.adminView = new app.LibraryAdminView({ el: "#admin" }).render();
    var librarySummaryView = app.librarySummaryView = new app.LibrarySummaryView({ el: "#librarySummary", model: bookCount });
    //var libraryView = app.libraryView = new app.LibraryView({ el: "#books", collection: library });
});
