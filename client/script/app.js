var app = app || {};

///////////////////////////////////////////////////////////////////////////////
// App config
///////////////////////////////////////////////////////////////////////////////

app.SERVER_URL = "http://127.0.0.1:4711";

app.LIBRARY_PAGINATION_SIZE = 20;

app.KEYUP_TRIGGER_DELAY_IN_MILLIS = 400;


///////////////////////////////////////////////////////////////////////////////
// Helper functions
///////////////////////////////////////////////////////////////////////////////

// http://stackoverflow.com/questions/680241/resetting-a-multi-stage-form-with-jquery
function resetFormInputFields($form) {
    $form.find("input:text, input:password, input:file, select, textarea").val("");
    $form.find("input:radio, input:checkbox").removeAttr("checked").removeAttr("selected");
}

function disableFormInputFields($form) {
    $form.find("input:text, input:password, input:file, select, textarea").attr("disabled", "disabled");
}

function prettyprintInteger(int) {
    return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}


///////////////////////////////////////////////////////////////////////////////
// HTTP server push events config
///////////////////////////////////////////////////////////////////////////////

// TODO: consider renaming to 'PushServer'
app.ServerPushClient = Backbone.Model.extend({
    socket: null,

    createPushMessage: function () {
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
    },

    /** Generic push event subscription */
    listenForPushEvent: function (eventId, callback) {
        var self = this;
        this.socket.on(eventId, function () {
            // http://stackoverflow.com/questions/960866/converting-the-arguments-object-to-an-array-in-javascript
            var args = Array.prototype.slice.call(arguments, 0),
                marshalledArgs;
            //args = args.sort(); // Screws things up somehow ...
            args.unshift(eventId);
            _.each(args, function (arg, index) {
                if (_.isObject(arg)) {
                    args[index] = JSON.stringify(arg);
                }
            });
            // TODO: like this:
            /*
             marshalledArgs = _.map(args, function (arg) {
             if (_.isObject(arg)) {
             return JSON.stringify(arg);
             } else {
             return null;
             }
             });
             */
            marshalledArgs = args;
            console.log(self.createPushMessage.apply(self, marshalledArgs));
            self.trigger.apply(self, marshalledArgs);
            if (callback) {
                callback.apply(self, arguments);
            }
        });
    },

    initialize: function () {
        this.socket = io.connect(this.get("serverUrl"));

        this.listenForPushEvent("cqrs", app.refreshViews);

        this.listenForPushEvent("replaying-events");
        this.listenForPushEvent("event-replayed");
        this.listenForPushEvent("all-events-replayed", app.refreshViews);

        this.listenForPushEvent("acquiring-sequencenumbers");
        this.listenForPushEvent("sequencenumber-acquired");
        this.listenForPushEvent("all-sequencenumbers-acquired");

        this.listenForPushEvent("creating-statechangeevents");
        this.listenForPushEvent("statechangeevent-created");
        this.listenForPushEvent("all-statechangeevents-created");

        this.listenForPushEvent("generating-books");
        this.listenForPushEvent("book-generated");
        this.listenForPushEvent("all-books-generated", app.refreshViews);

        this.listenForPushEvent("book-updated", function (updatedBook) {
            app.library.set(updatedBook, { add: false, remove: false, merge: true });
            app.refreshViews();
            if (app.bookView.model && app.bookView.model.id === updatedBook[app.Book.prototype.idAttribute]) {
                app.bookView.bookView.render();
            }
        });
        this.listenForPushEvent("book-removed", function (entityIdOfRemovedBook) {
            app.library.remove(app.library.get(entityIdOfRemovedBook));
            app.refreshViews();
            if (app.bookView.model && app.bookView.model.id === entityIdOfRemovedBook) {
                app.bookView.reset();
            }
        });
        this.listenForPushEvent("all-books-removed", function () {
            //app.library.reset(); // Needed?
            app.refreshViews();
            // TODO: reset form fields
            //app.bookView.clear();
            // TODO: collapse view (if expanded))
            //app.bookView.collapse();
        });
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

    // Connect to server for HTTP server push
    // Dependant on models, views dependant on this
    // TODO: consider renaming to 'server'/'pushServer'
    app.pushClient = new app.ServerPushClient({ serverUrl: app.SERVER_URL });

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
    app.router = new app.AppRouter();
    Backbone.history.start();

    // Initial view rendering
    app.refreshViews();
});
