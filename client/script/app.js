var app = app || {};

app.LIBRARY_PAGINATION_SIZE = 20;
app.KEYUP_TRIGGER_DELAY_IN_MILLIS = 400;


///////////////////////////////////////////////////////////////////////////////
// Models
///////////////////////////////////////////////////////////////////////////////

app.CqrsCheck = Backbone.Model.extend({
    url: "/events/cqrs/status"
});

app.CqrsToggle = Backbone.Model.extend({
    url: "/events/cqrs/toggle"
});

app.EventStoreCount = Backbone.Model.extend({
    default: { totalCount: 0, createCount: 0, updateCount: 0, deleteCount: 0 },
    url: "/events/count"
});

app.EventStoreReplay = Backbone.Model.extend({
    url: "/events/replay"
});

//app.CreateBookCommand = Backbone.Model.extend({
//    url: "/library/books/newbook"
//});

app.GenerateRandomBooksCommand = Backbone.Model.extend({
    url: "/library/books/generate"
});

app.RemoveAllBooks = Backbone.Model.extend({
    url: "/library/books/clean"
});


///////////////////////////////////////////////////////////////////////////////
// Views
///////////////////////////////////////////////////////////////////////////////

app.StateChangeAdminView = Backbone.View.extend({
    templateSelector: "#stateChangeAdminTemplate",
    template: null,
    events: {
        "click #toggleCqrs": "_toggleCqrs",
        "click #replay": "_replayChangeLog"
    },
    cqrsActive: false,

    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.model, "change", this.render);
        this.model.fetch();
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        this._checkCqrs();
    },
    renderButtons: function (usingCqrs) {
        if (usingCqrs) {
            this.cqrsActive = true;
            this.$("#toggleCqrs").removeClass("btn-warning").addClass("btn-success").empty().append("CQRS ON");
            this.$("#replay").removeClass("disabled").attr("title", "");
        } else {
            this.cqrsActive = false;
            this.$("#toggleCqrs").addClass("btn-warning").removeClass("btn-success").empty().append("CQRS OFF");
            this.$("#replay").addClass("disabled").attr("title", "N/A as CQRS is disabled");
        }
    },
    _checkCqrs: function () {
        new app.CqrsCheck().fetch().done(_.bind(this.renderButtons, this));
    },
    _toggleCqrs: function () {
        new app.CqrsToggle().save();
    },
    _replayChangeLog: function (event) {
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
        this.render();
    },
    render: function () {
        this.$el.html($(this.templateSelector).html());
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
// Application bootstrapper (When DOM is ready ...)
///////////////////////////////////////////////////////////////////////////////

$(function () {

    // Models
    app.stateChangeCount = new app.EventStoreCount();
    app.bookCount = new app.BookCountQuery();
    app.library = new app.Library({ pagination: true, filtering: true });

    // On demand: Update state change count and book count
    app.refreshViews = function () {
        app.stateChangeCount.fetch();
        app.bookCount.save();
        app.library.fetch();
    };

    // Views
    app.stateChangeAdminView = new app.StateChangeAdminView({ el: "#stateChangeAdmin", model: app.stateChangeCount });
    app.libraryAdminView = new app.LibraryAdminView({ el: "#libraryAdmin" });
    app.bookCountView = new app.BookCountView({ el: "#libraryBookCount", model: app.bookCount });
    app.bookView = new app.BookCompositeView({ el: "#book" });
    app.bookListView = new app.BookListTableView({ el: "#bookList", collection: app.library });

    // "Out-of-view" DOM events: Toggle book listing
    $("#bookListLink").on("click", function (event) {
        event.preventDefault();
        if (app.bookListView.isVisible()) {
            app.bookListView.close();
        } else {
            app.library.fetch();
        }
    });

    // Start listening for URI hash changes
    app.appRouter = new app.AppRouter();
    Backbone.history.start();

    // Initial view rendering
    app.refreshViews();


    ///////////////////////////////////////////////////////////////////////////////
    // HTTP server push events config
    ///////////////////////////////////////////////////////////////////////////////

    var socket = io.connect('http://localhost:4711'),

        pushMessage = function () {
            var msg = arguments[0],
                pushMsgArgs = _.rest(arguments),
                hasMsgArgs = !_.isEmpty(pushMsgArgs),
                retVal = "PUSH { " + msg;

            if (hasMsgArgs) {
                retVal += " { ";
            }
            _.each(pushMsgArgs, function (pushMsgArg, index) {
                retVal += pushMsgArg;
                if (index < pushMsgArgs.length - 1) {
                    retVal += ", ";
                }
            });
            if (hasMsgArgs) {
                retVal += " }";
            }
            retVal += " }";
            return retVal;
        };

    // Push event: CQRS mode changed
    socket.on("cqrs", function (cqrsInUse) {
        console.log(pushMessage("cqrs", cqrsInUse));
        app.refreshViews();
        app.stateChangeAdminView.renderButtons(cqrsInUse);
    });

    // Push event: Replaying of all stage change events started
    socket.on("replaying-events", function () {
        console.log(pushMessage("replaying-events"));
    });

    // Push event: Stage change events replayed
    socket.on("event-replayed", function (index) {
        console.log(pushMessage("event-replayed", index));
    });

    // Push event: Replaying of all state change events are completed
    socket.on("all-events-replayed", function (totalNumberOfEvents) {
        console.log(pushMessage("all-events-replayed", totalNumberOfEvents));
        app.refreshViews();
    });

    // Push event: Generating books started ...
    socket.on("generating-books", function (numberOfBooksToAdd) {
        console.log(pushMessage("generating-books", numberOfBooksToAdd));
    });

    // Push event: (Single) book generated
    socket.on("book-generated", function (bookNumberInSequence, book) {
        console.log(pushMessage("book-generated", "#" + bookNumberInSequence + ": " + JSON.stringify(book)));
    });

    // Push event: (All) books generated
    socket.on("all-books-generated", function (numberOfBooksAdded) {
        console.log(pushMessage("all-books-generated", numberOfBooksAdded));
        app.refreshViews();
    });

    // Push event: Book updated
    socket.on("book-updated", function (updatedBook) {
        console.log(pushMessage("book-updated", JSON.stringify(updatedBook)));
        app.library.set(updatedBook, { add: false, remove: false, merge: true });
        app.refreshViews();
        if (app.bookView.model && app.bookView.model.id === updatedBook[app.Book.prototype.idAttribute]) {
            app.bookView.bookView.render();
        }
    });

    // Push event: Book removed
    socket.on("book-removed", function (entityIdOfRemovedBook) {
        console.log(pushMessage("book-removed", entityIdOfRemovedBook));
        app.library.remove(app.library.get(entityIdOfRemovedBook));
        app.refreshViews();
        if (app.bookView.model && app.bookView.model.id === entityIdOfRemovedBook) {
            app.bookView.reset();
        }
    });

    // Push event: Application store purged / all books removed
    socket.on("books-removed", function () {
        console.log(pushMessage("books-removed"));
        //app.library.reset(); // Needed?
        app.refreshViews();
        // TODO: reset form fields
        //app.bookView.clear();
        // TODO: collapse view (if expanded))
        //app.bookView.collapse();
    });
});
