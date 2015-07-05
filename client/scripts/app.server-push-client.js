/* global define:false, JSON:false */

define(['socket.io', 'underscore', 'backbone', 'app', 'app.book'],

    function (SocketIo, _, Backbone, App, Book) {
        'use strict';

        /** HTTP server push events config */
        return Backbone.Model.extend({

            defaults: {
                socket: null,
                serverUrl: null,
                connected: false
            },


            createLogMessage: function () {
                var msg = arguments[0],
                    pushMsgArgs = _.rest(arguments),
                    hasMsgArgs = !_.isEmpty(pushMsgArgs),
                    retVal = 'Server Push { ' + msg;

                if (hasMsgArgs) {
                    retVal += ' { ';
                }
                _.each(pushMsgArgs, function (pushMsgArg, index) {
                    retVal += pushMsgArg;
                    if (index < pushMsgArgs.length - 1) {
                        retVal += ', ';
                    }
                });
                if (hasMsgArgs) {
                    retVal += ' }';
                }
                retVal += ' }';
                return retVal;
            },


            /** Generic push event subscription */
            listenForPushEvent: function (eventId, callback) {
                var self = this;
                this.get('socket').on(eventId, function () {
                    // http://stackoverflow.com/questions/960866/converting-the-arguments-object-to-an-array-in-javascript
                    var args = Array.prototype.slice.call(arguments, 0),
                        marshalledArgs;
                    //args = args.sort(); // Screw things up somehow ...
                    args.unshift(eventId);
                    marshalledArgs = _.map(args, function (arg) {
                        return _.isObject(arg) ? JSON.stringify(arg) : arg;
                    });

                    console.log(self.createLogMessage.apply(self, marshalledArgs));

                    self.trigger.apply(self, marshalledArgs);

                    if (callback) {
                        callback.apply(self, arguments);
                    }
                });
            },


            initialize: function () {
                if (!this.get('connected')) {
                    this.set('connected', true);
                    this.set('socket', SocketIo.connect(this.get('serverUrl')));
                    console.log('Connecting to ' + this.get('serverUrl') + ' ...');
                } else {
                    console.log('Already connected to ' + this.get('serverUrl') + ' ... not re-trying');
                }

                this.listenForPushEvent('number-of-connections');

                this.listenForPushEvent('cqrs', App.refreshViews);

                this.listenForPushEvent('creating-book-statechangeevents');
                this.listenForPushEvent('book-statechangeevent-created');
                this.listenForPushEvent('all-book-statechangeevents-created', App.refreshViews);

                this.listenForPushEvent('creating-visit-statechangeevents');
                this.listenForPushEvent('visit-statechangeevent-created');
                this.listenForPushEvent('all-visit-statechangeevents-created', App.refreshViews);

                this.listenForPushEvent('mapreducing-events');
                this.listenForPushEvent('event-mapreduced');
                this.listenForPushEvent('all-events-mapreduced');

                this.listenForPushEvent('replaying-events');
                this.listenForPushEvent('event-replayed');
                this.listenForPushEvent('all-events-replayed', App.refreshViews);

                this.listenForPushEvent('book-updated', function (updatedBook) {
                    App.library.set(updatedBook, { add: false, remove: false, merge: true });
                    App.refreshViews();
                    if (App.bookView.model && App.bookView.model.id === updatedBook[Book.prototype.idAttribute]) {
                        App.bookView.bookView.render();
                    }
                });
                this.listenForPushEvent('book-removed', function (entityIdOfRemovedBook) {
                    App.library.remove(App.library.get(entityIdOfRemovedBook));
                    App.refreshViews();
                    if (App.bookView.model && App.bookView.model.id === entityIdOfRemovedBook) {
                        App.bookView.reset();
                    }
                });
                this.listenForPushEvent('all-books-removed', function () {
                    App.refreshViews();
                    // TODO: reset form fields
                    //App.bookView.clear();
                    // TODO: collapse view (if expanded))
                    //App.bookView.collapse();
                });
            }
        });
    }
);
