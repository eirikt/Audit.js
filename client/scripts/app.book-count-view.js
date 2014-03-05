define(["jquery", "underscore", "backbone"]

    , function ($, _, Backbone) {
        "use strict";

        return Backbone.View.extend({
            template: _.template('' +
                '<span>Total number of books:</span>' +
                '<span class="pull-right lead"><strong><%= count %></strong></span>'
            ),
            initialize: function () {
                this.listenTo(this.model, "sync change", this.render);
            },
            render: function () {
                var model = this.model.toJSON();
                model.count = prettyprintInteger(model.count);
                this.$el.empty().append(this.template(model));
            }
        });
    }
);
