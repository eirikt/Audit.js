/* global define:false */
define(['underscore', 'backbone'],

    function (_, Backbone) {
        'use strict';

        /**
         * Simple network connectivity status model, known from Axess Bridge | Equip.
         * A simple status model mapping Socket.IO events.
         */
        return Backbone.Model.extend({
            defaults: {
                pushClient: null,

                unknownStatusImagePath: '/images/led_circle_grey.png',
                unknownStatusCaption: 'unknown network connection status',

                greenStatusImagePath: '/images/led_circle_green.png',
                greenStatusCaption: 'online',

                yellowStatusImagePath: '/images/led_circle_yellow.png',
                yellowStatusCaption: 'slow network connection',

                redStatusImagePath: '/images/led_circle_red.png',
                redStatusCaption: 'offline'
            },

            initialize: function (attributes) {
                var self = this,
                    networkSniffer = attributes.pushClient;

                this.set('statusImagePath', this.get('unknownStatusImagePath'), { silent: true });
                this.set('statusCaption', this.get('unknownStatusCaption'));

                this.listenTo(networkSniffer, 'onunknownconnection', function () {
                    if (self.get('statusImagePath') !== self.get('unknownStatusImagePath')) {
                        self.set('statusImagePath', self.get('unknownStatusImagePath'), { silent: true });
                        self.set('statusCaption', self.get('unknownStatusCaption'));
                    }
                });

                this.listenTo(networkSniffer, 'onconnected', function () {
                    if (self.get('statusImagePath') !== self.get('greenStatusImagePath')) {
                        self.set('statusImagePath', self.get('greenStatusImagePath'), { silent: true });
                        self.set('statusCaption', self.get('greenStatusCaption'));
                    }
                });

                this.listenTo(networkSniffer, 'onslowconnection', function () {
                    if (self.get('statusImagePath') !== self.get('yellowStatusImagePath')) {
                        self.set('statusImagePath', self.get('yellowStatusImagePath'), { silent: true });
                        self.set('statusCaption', self.get('yellowStatusCaption'));
                    }
                });

                this.listenTo(networkSniffer, 'ondisconnected', function () {
                    if (self.get('statusImagePath') !== self.get('redStatusImagePath')) {
                        self.set('statusImagePath', self.get('redStatusImagePath'), { silent: true });
                        self.set('statusCaption', self.get('redStatusCaption'));
                    }
                });
            }
        });
    }
);
