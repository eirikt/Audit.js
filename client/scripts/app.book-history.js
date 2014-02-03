define(["underscore", "backbone", "backbone.audit.statechangecollection"]

    , function (_, Backbone, StateChangeCollection) {
        "use strict";

        return StateChangeCollection.extend({
            url: function () {
                if (!this.target) {
                    throw new Error("Missing target entity");
                }
                if (!this.target.id) {
                    throw new Error("Missing target entity ID");
                }
                return "/events/" + this.target.id;
            }
        });
    }
);
