define(["underscore", "backbone"]

    , function (_, Backbone) {
        "use strict";

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
