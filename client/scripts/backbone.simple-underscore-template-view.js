define(["underscore", "backbone"]

    , function (_, Backbone) {
        "use strict";

        /**
         * Simple Underscore-based Backbone view.
         *
         * @param {Object} attr mandatory
         * @param {String} attr.model mandatory model
         * @param {String} attr.template mandatory in disjunction with <code>templateSelector</code>
         * @param {String} attr.templateSelector mandatory in disjunction with <code>template</code>
         */
        return Backbone.View.extend({
            initialize: function (attr) {
                this.model = attr.model;
                if (attr.template) {
                    this.template = attr.template;
                } else {
                    this.template = _.template($(attr.templateSelector).html());
                }
                this.render();
            },
            render: function () {
                this.$el.empty().append(this.template(this.model.toJSON()));
            }
        });
    }
);
