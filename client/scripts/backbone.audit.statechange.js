define(["underscore", "backbone"]

    , function (_, Backbone) {
        "use strict";

        return Backbone.Model.extend({

            /** Mongo DB-friendly default ID property key. */
            idAttribute: "_id",

            default: {
                timestamp: null,
                user: null,
                method: null,
                type: null,
                entityId: null,
                changes: null,

                /** Client-side only one-based sequence number (in parent collection). */
                seq: null,

                /** Client-side only flag telling if this is the current state after a rewind. */
                currentState: false
            },

            isCreate: function () {
                return this.get("method") === "CREATE";
            },

            isUpdate: function () {
                return this.get("method") === "UPDATE";
            },

            isDelete: function () {
                return Audit.StateChange.isDeleteMethod(this.get("method"));
            }

        }, {
            isDeleteMethod: function (method) {
                return _.isString(method) && method === "DELETE";
            }
        });
    }
);
