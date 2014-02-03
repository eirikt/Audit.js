define(["underscore", "backbone"]

    , function (_, Backbone, app) {
        "use strict";

        // TODO: Get rid of the top span as well ...
        var template = _.template('' +
            '<span>'+
            '  Number of connected users:&nbsp;' +
            '  <strong><%= numberOfUsers %></strong>' +
            '  &nbsp;&nbsp;&nbsp;' +
            '</span>'
        );

        return Backbone.View.extend({
            initialize: function () {
                this.listenTo(this.model, "change", this.render);
                this.render();
            },
            render: function () {
                this.$el.html(template(this.model.toJSON()));
            }
        });
    }
);
