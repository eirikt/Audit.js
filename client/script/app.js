var app = app || {};

app.KEYUP_TRIGGER_DELAY_IN_MILLIS = 400;


///////////////////////////////////////////////////////////////////////////////
// Models
///////////////////////////////////////////////////////////////////////////////

app.CqrsCheck = Backbone.Model.extend({
    urlRoot: "/events/cqrs/status"
});

app.CqrsToggle = Backbone.Model.extend({
    urlRoot: "/events/cqrs/toggle"
});

app.EventStoreCount = Backbone.Model.extend({
    default: { totalCount: 0, createCount: 0, updateCount: 0, deleteCount: 0 },
    urlRoot: "/events/count"
});

app.EventStoreReplay = Backbone.Model.extend({
    urlRoot: "/events/replay"
});

//app.CreateBookCommand = Backbone.Model.extend({
//    urlRoot: "/library/books/create"
//});

app.GenerateRandomBooksCommand = Backbone.Model.extend({
    urlRoot: "/library/books/generate"
});

app.RemoveAllBooks = Backbone.Model.extend({
    urlRoot: "/library/books/clean"
});


///////////////////////////////////////////////////////////////////////////////
// Views
///////////////////////////////////////////////////////////////////////////////

app.StateChangeAdminView = Backbone.View.extend({
    templateSelector: "#stateChangeAdminTemplate",
    template: null,
    events: {
        "click #toggleCqrs": "toggleCqrs",
        "click #replay": "replayChangeLog"
    },
    cqrsActive: true,

    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.model, "change", this.render);
        this.model.fetch();
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        this.checkCqrs();
    },
    checkCqrs: function () {
        var self = this;
        new app.CqrsCheck().fetch().done(function (usingCqrs) {
            if (usingCqrs) {
                self.cqrsActive = true;
                self.$("#toggleCqrs").removeClass("btn-warning").addClass("btn-success").empty().append("CQRS ON");
                self.$("#replay").removeClass("disabled").attr("title", "");
            } else {
                self.cqrsActive = false;
                self.$("#toggleCqrs").addClass("btn-warning").removeClass("btn-success").empty().append("CQRS OFF");
                self.$("#replay").addClass("disabled").attr("title", "N/A as CQRS is disabled");
            }
        });
    },
    toggleCqrs: function () {
        var self = this;
        new app.CqrsToggle().save().done(function (usingCqrs) {
            if (usingCqrs) {
                self.cqrsActive = true;
                self.$("#toggleCqrs").removeClass("btn-warning").addClass("btn-success").empty().append("CQRS ON");
                self.$("#replay").removeClass("disabled").attr("title", "");
            } else {
                self.cqrsActive = false;
                self.$("#toggleCqrs").addClass("btn-warning").removeClass("btn-success").empty().append("CQRS OFF");
                self.$("#replay").addClass("disabled").attr("title", "N/A as CQRS is disabled");
            }
        });
    },
    replayChangeLog: function (event) {
        if (this.cqrsActive) {
            new app.EventStoreReplay().save();
        } else {
            event.preventDefault();
        }
    }
});


app.LibraryAdminView = Backbone.View.extend({
    templateSelector: "#libraryAdminTemplate",
    template: null,
    events: {
        "click #generate": "generateRandomBooks",
        "click #removeAllBooks": "removeAllBooks"
    },
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        //this.listenTo(this.model, "change", this.render);
        //this.model.fetch();
        this.render();
    },
    render: function () {
        this.$el.html(this.template({}));//this.model.toJSON()));
        this.trigger("rendered");
    },
    generateRandomBooks: function () {
        var numberOfBooksToGenerate = parseInt(this.$("#numberOfBooksToGenerate").val());
        console.log("generateRandomBooks: " + numberOfBooksToGenerate + " books");
        if (numberOfBooksToGenerate) {
            new app.GenerateRandomBooksCommand().save({ numberOfBooks: numberOfBooksToGenerate });
        }
    },
    removeAllBooks: function () {
        new app.RemoveAllBooks().save();
    }
});


///////////////////////////////////////////////////////////////////////////////
// Router
///////////////////////////////////////////////////////////////////////////////

app.AppRouter = Backbone.Router.extend({

    routes: { "library/books/:entityId": "showBook" },

    showBook: function (entityId) {
        if (app.bookView.model) {
            Backbone.stopListening(app.bookView.model.history);
            Backbone.stopListening(app.bookView.model);
        }
        var book = app.library.get(entityId);
        if (book) {
            // TODO: How to include this in a more ... integrated way
            if (!book.history) {
                book.history = new app.BookHistory({ target: book });
            }
            app.bookView.model = book;
            Backbone.listenTo(app.bookView.model, "change destroy", app.refreshCounts);
            Backbone.listenTo(app.bookView.model, "change", _.bind(app.bookListView.render, app.bookListView));
            app.bookView.render();

        } else {
            // Direct URL
            throw new Error("Direct URL access is not yet implemented");
        }
    }
});


///////////////////////////////////////////////////////////////////////////////
// Bootstrapper (When DOM is ready ...)
///////////////////////////////////////////////////////////////////////////////

$(function () {

    // Models
    app.stateChangeCount = new app.EventStoreCount();
    app.bookCount = new app.BookCountQuery();
    app.bookSearchAndCount = new app.BookCountQuery();
    app.library = new app.Library({ pagination: true });

    // On demand: Update state change count and book count
    app.refreshCounts = function () {
        app.stateChangeCount.save();
        app.bookCount.save();
        app.bookSearchAndCount.save();
        app.library.fetch({ reset: true });
    };

    // Views
    app.stateChangeAdminView = new app.StateChangeAdminView({ el: "#stateChangeAdmin", model: app.stateChangeCount });
    app.libraryAdminView = new app.LibraryAdminView({ el: "#libraryAdmin" });
    app.bookCountView = new app.BookCountView({ el: "#libraryBookCount", model: app.bookCount });
    app.bookView = new app.BookCompositeView({ el: "#book" });
    app.bookSearchView = new app.BookSearchView({ el: "#bookSearchAndCount", model: app.bookSearchAndCount });
    app.bookListView = new app.BookListTableView({ el: "#bookList", collection: app.library });

    // "Out-of-view" DOM events: Toggle book listing
    $("#bookListLink").on("click", function (event) {
        event.preventDefault();
        if (app.bookListView.isVisible()) {
            app.bookListView.close();
        } else {
            app.bookListView.collection.fetch({ reset: true });
        }
    });

    // Start listening for URI hash changes
    app.appRouter = new app.AppRouter();
    Backbone.history.start();

    // Initial view rendering
    app.refreshCounts();


    ///////////////////////////////////////////////////////////////////////////////
    // HTTP server push events config
    ///////////////////////////////////////////////////////////////////////////////

    var socket = io.connect('http://localhost:4711');

    // Push event: Starting adding books ...
    socket.on("adding-books", function (numberOfBooksToAdd) {
        console.log("adding-books: " + numberOfBooksToAdd);
    });

    // Push event: Book added
    socket.on("book-added", function (bookNumberInSequence, book) {
        console.log("book-added: ¤" + bookNumberInSequence + ", " + book.title);
    });

    // Push event: Books added
    socket.on("books-added", function (numberOfBooksAdded) {
        console.log("books-added: " + numberOfBooksAdded);
        app.refreshCounts();
    });

    // Push event: Book updated
    socket.on("book-updated", function (updatedBook) {
        console.log("book-updated: " + updatedBook);
        app.library.set(updatedBook, { add: false, remove: false, merge: true });
        app.refreshCounts();
        if (app.bookView.model && app.bookView.model.id === updatedBook[app.Book.prototype.idAttribute]) {
            app.bookView.bookView.render();
        }
    });

    // Push event: Book removed
    socket.on("book-removed", function (entityIdOfRemovedBook) {
        console.log("book-removed: " + entityIdOfRemovedBook);
        app.library.remove(app.library.get(entityIdOfRemovedBook));
        app.refreshCounts();
        if (app.bookView.model && app.bookView.model.id === entityIdOfRemovedBook) {
            app.bookView.reset();
        }
    });

    // Push event: Library removed/All books removed
    socket.on("books-removed", function () {
        console.log("books-removed");
        app.library.reset();
        app.refreshCounts();
        // TODO: reset form fields
        //app.bookView.clear();
        // TODO: collapse view (if expanded))
        //app.bookView.collapse();
    });

    // Push event: Event store replayed (in full)
    socket.on("events-replayed", function () {
        console.log("events-replayed");
        app.library.fetch({ reset: true });
        app.refreshCounts();
    });
});
