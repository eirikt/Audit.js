/* global define: false */
define(["underscore", "backbone", "backbone.audit.statechange"]

    , function (_, Backbone, BackboneAuditStateChange) {
        "use strict";

        /**
         * (Zero-based) Read-only collection of state changes.
         * Always be sorted after ascending 'StateChange.timestamp'.
         */
        return Backbone.Collection.extend({

            model: BackboneAuditStateChange,

            /** The entity/model object this state change collection represents. */
            target: null,

            /** Zero is present, negative numbers mean further and further back in time. */
            stateIndex: 0,

            initialize: function (options) {
                this.target = options.target;
            },

            parse: function (stateChangeObjArrayFromServer) {
                var isDeletedTarget = false;
                if (stateChangeObjArrayFromServer) {
                    isDeletedTarget = this.model.isDeleteMethod(stateChangeObjArrayFromServer[stateChangeObjArrayFromServer.length - 1].method);
                }
                _.each(stateChangeObjArrayFromServer, function (stateChangeObj, zeroBasedIndex) {
                    stateChangeObj.seq = zeroBasedIndex + 1;
                    if (isDeletedTarget) {
                        // When deleted, all state changes are set to 'currentState: true' to avoid them being linked ...
                        // TODO: Better solution ...
                        stateChangeObj.currentState = true;
                    } else {
                        stateChangeObj.currentState = stateChangeObj.seq === stateChangeObjArrayFromServer.length;
                    }
                });
                return stateChangeObjArrayFromServer;
            }
        });
    }
);
