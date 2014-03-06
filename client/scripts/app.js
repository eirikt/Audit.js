/* global require: false, define: false */
require([
    'underscore', 'backbone', 'jquery', 'jquery.bootstrap',
    'app', 'app.server-push-client', 'app.router',
    'app.statechange-admin-view', 'app.library-admin-view', 'app.user-admin-view',
    'app.library', 'app.book-count-view', 'app.book-composite-view', 'app.book-table-view'],

    function (_, Backbone, $, Bootstrap, App, PushClient, Router, StateChangeAdminView, LibraryAdminView, UserAdminView, Library, BookCountView, BookCompositeView, BookListTableView) {

        "use strict";

        /**
         * Application starting point (when DOM is ready ...)
         */
        $(function () {

            console.log("DOM ready! Starting ...");

            // Models
            var StateChangeCount = Backbone.Model.extend({
                defaults: {
                    totalCount: 0,
                    createCount: 0,
                    updateCount: 0,
                    deleteCount: 0
                },
                url: "/events/count"
            });
            App.stateChangeCount = new StateChangeCount();

            var BookCount = Backbone.Model.extend({
                defaults: {
                    titleSubstring: "",
                    authorSubstring: "",
                    keywords: null,
                    count: 0
                },
                url: "/library/books/count"
            });
            App.bookCount = new BookCount();

            App.library = new Library({ pagination: true, filtering: true });

            // On demand: Update state change count and book count
            App.refreshViews = function () {
                App.stateChangeCount.fetch();
                App.bookCount.save();
                App.library.fetch();
            };


            // Connect to server for HTTP server push
            // Dependant on SOME models, all views dependant on this
            App.pushClient = new PushClient({ serverUrl: App.SERVER_URL });


            var UserCount = Backbone.Model.extend({
                defaults: { numberOfUsers: 0 },
                initialize: function () {
                    this.listenTo(App.pushClient, "number-of-connections", function (numberOfConnections) {
                        this.set("numberOfUsers", numberOfConnections);
                    });
                }
            });
            App.userCount = new UserCount();


            // Views
            App.stateChangeAdminView = new StateChangeAdminView({ el: "#stateChangeAdmin", model: App.stateChangeCount });
            App.libraryAdminView = new LibraryAdminView({ el: "#libraryAdmin" });
            App.userAdminView = new UserAdminView({ el: "#userAdmin", model: App.userCount });
            App.bookCountView = new BookCountView({ el: "#libraryBookCount", model: App.bookCount });
            App.bookView = new BookCompositeView({ el: "#book" });
            App.bookListView = new BookListTableView({ el: "#bookList", collection: App.library });

            // "Out-of-view" DOM events: Toggle book listing
            $("#bookListLink").on("click", function (event) {
                event.preventDefault();
                if (App.bookListView.isVisible()) {
                    App.bookListView.close();
                } else {
                    App.library.fetch();
                }
            });

            // Start listening for URI hash changes
            App.router = new Router();
            Backbone.history.start();

            // Initial view rendering
            App.refreshViews();
        });
    }
);


define([]

    , function () {
        "use strict";

        /**
         * Application configuration and placeholder
         */
        return {
            SERVER_URL: "http://127.0.0.1:4711", // For server push client setup
            LIBRARY_PAGINATION_SIZE: 20,
            KEYUP_TRIGGER_DELAY_IN_MILLIS: 400
        };
    }
);


///////////////////////////////////////////////////////////////////////////////
// Global helper functions
///////////////////////////////////////////////////////////////////////////////

// http://stackoverflow.com/questions/680241/resetting-a-multi-stage-form-with-jquery
function resetFormInputFields($form) {
    "use strict";
    $form.find("input:text, input:password, input:file, select, textarea").val("");
    $form.find("input:radio, input:checkbox").removeAttr("checked").removeAttr("selected");
}

function disableFormInputFields($form) {
    "use strict";
    $form.find("input:text, input:password, input:file, select, textarea").attr("disabled", "disabled");
}

function prettyprintInteger(integer) {
    "use strict";
    if (integer === 0) {
        return "0";
    }
    return integer ? integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") : "";
}
