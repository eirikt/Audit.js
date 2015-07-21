/* global define:false */
define(['jquery', 'underscore', 'backbone'],

    function ($, _, Backbone) {
        'use strict';

        /** Simple status indicator with caption. */
        return Backbone.View.extend({
            tagName: 'span',

            // className and style should be set, e.g. like this:
            // DataStatusView.prototype.className = null;
            // DataStatusView.prototype.style = 'margin-left: 2rem; font-size: x-small; vertical-align: 10%;';
            className: null,
            style: null,

            template: _.template('' +
                '<span style="width:100%;">' +
                '  <img src="<%= statusImagePath %>" width="12px" />' +
                '  <span style="margin-left:.5rem;"><%= statusCaption %></span>' +
                '</span>'
            ),
            attributes: function () {
                return { style: this.style };
            },
            initialize: function () {
                this.listenTo(this.model, 'change', this.render);
                this.$el.empty().append(this.template(this.model.toJSON()));
            },
            render: function () {
                var self = this;
                this.$el.fadeOut('slow', function () {
                    self.$el.empty().append(self.template(self.model.toJSON()));
                    self.$el.fadeIn();
                });
            }
        });
    }
);
