/* global require: false, define: false */

require([
        'underscore', 'backbone', 'jquery', 'jquery.bootstrap',
        'app', 'app.server-push-client', 'backbone.network-status', 'backbone.status-view', 'app.router',
        'backbone.progressbar', 'backbone.bootstrap.multi-progressbar-view', 'app.statechange-admin-view', 'app.library-admin-view', 'app.user-admin-view',
        'app.library', 'app.book-count-view', 'app.book-composite-view', 'app.book-table-view'],

    function (_, Backbone, $, Bootstrap, App, PushClient, NetworkStatus, NetworkStatusView, Router, Progressbar, BootstrapModalMultipleProgressbarView, StateChangeAdminView, LibraryAdminView, UserAdminView, Library, BookCountView, BookCompositeView, BookListTableView) {
        'use strict';

        var preloadOfflineImages = function () {
            $('<img/>')[0].src = '/images/led_circle_grey.png';
            $('<img/>')[0].src = '/images/led_circle_yellow.png';
            $('<img/>')[0].src = '/images/led_circle_red.png';
        };

        /**
         * Application starting point (when DOM is ready ...)
         */
        $(function () {
            console.log('DOM ready! Starting ...');

            preloadOfflineImages();


            // On demand: Update state change count and book count
            App.refreshViews = function () {
                App.stateChangeCount.fetch();

                //App.bookCount.save();
                App.bookCountView.renderChildViews();

                if (App.bookListView.isVisible()) {
                    App.library.fetch();
                }
            };


            // Models

            // Connect to server for HTTP server push
            App.pushClient = new PushClient({ serverUrl: App.SERVER_URL });
            App.networkStatus = new NetworkStatus({ pushClient: App.pushClient });

            var StateChangeCount = Backbone.Model.extend({
                defaults: {
                    totalCount: 0,
                    createCount: 0,
                    updateCount: 0,
                    deleteCount: 0
                },
                url: '/events/count',
                fetch: function () {
                    return Backbone.Model.prototype.fetch.call(this, {
                        type: 'POST',
                        url: this.url
                    });
                }
            });
            App.stateChangeCount = new StateChangeCount();

            App.library = new Library({ pagination: true, filtering: true });

            var UserCount = Backbone.Model.extend({
                defaults: { numberOfUsers: 0 },
                initialize: function () {
                    this.listenTo(App.pushClient, 'number-of-connections', function (numberOfConnections) {
                        this.set('numberOfUsers', numberOfConnections);
                    });
                }
            });
            App.userCount = new UserCount();
            // /Models


            // Views
            NetworkStatusView.prototype.className = 'navbar-brand'; // Bootstrap accordions ...
            NetworkStatusView.prototype.style = 'margin-left:2rem;font-size:12px;vertical-align:middle;';
            App.networkStatusView = new NetworkStatusView({ model: App.networkStatus });

            App.stateChangeAdminView = new StateChangeAdminView({ model: App.stateChangeCount });

            App.libraryAdminView = new LibraryAdminView();

            App.userAdminView = new UserAdminView({ model: App.userCount });

            App.bookCountView = new BookCountView();

            App.bookView = new BookCompositeView();

            App.bookListView = new BookListTableView({ collection: App.library });

            // Attach views to the DOM
            $('#networkStatus').append(App.networkStatusView.el);
            $('#stateChangeAdmin').append(App.stateChangeAdminView.el);
            $('#userAdmin').append(App.userAdminView.el);
            $('#libraryAdmin').append(App.libraryAdminView.el);
            $('#libraryOverview').append(App.bookCountView.el);
            $('#book').append(App.bookView.el);
            $('#bookList').append(App.bookListView.el);
            // /Views


            // 'Out-of-view' DOM events: Toggle book listing
            $('#bookListLink').on('click', function (event) {
                event.preventDefault();
                if (App.bookListView.isVisible()) {
                    App.bookListView.close();
                } else {
                    App.library.fetch();
                }
            });


            // Initial view rendering
            App.refreshViews();


            // Start listening for URI hash changes
            App.router = new Router();
            Backbone.history.start();
        });
    }
);


// The definition of the 'App' object, required by the above application bootstrapper function
define([], function () {
        'use strict';

        /**
         * Application configuration and placeholder
         */
        return {
            SERVER_URL: 'http://127.0.0.1:4711', // For server push client setup
            LIBRARY_PAGINATION_SIZE: 20,
            KEYUP_TRIGGER_DELAY_IN_MILLIS: 400
        };
    }
);


///////////////////////////////////////////////////////////////////////////////
// Global helper functions
///////////////////////////////////////////////////////////////////////////////

// http://stackoverflow.com/questions/680241/resetting-a-multi-stage-form-with-jquery
/* jshint -W098 */
function resetFormInputFields($form) {
    'use strict';
    $form.find('input:text, input:password, input:file, select, textarea').val('');
    $form.find('input:radio, input:checkbox').removeAttr('checked').removeAttr('selected');
}

function disableFormInputFields($form) {
    'use strict';
    $form.find('input:text, input:password, input:file, select, textarea').attr('disabled', 'disabled');
}

function prettyprintInt(integer) {
    'use strict';
    if (integer === 0) {
        return '0';
    }
    return integer ? integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';
}
