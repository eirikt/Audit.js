// TODO: Consider module pattern or something similar
var Backbone = Backbone || {};
var Audit = Backbone.Audit = {};

Backbone.Audit.StateChange = Backbone.Model.extend({

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


/**
 * (Zero-based) Read-only collection of state changes.
 * Always be sorted after ascending 'StateChange.timestamp'.
 */
Backbone.Audit.StateChangeCollection = Backbone.Collection.extend({

    model: Audit.StateChange,

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


/**
 * Mix-in for state-change-aware Backbone models.
 */
Backbone.Audit.History = {

    /**
     * Cloned/Snapshot version of this model.
     * Should always reflecting current server-side state.
     */
    _serverSideModel: null,

    /** The complete state change history of this model. */
    history: null,

    /** Overriding parse to make sure a server-side state snapshot is at hand. */
    parse: function (resp, options) {
        this._serverSideModel = this.clone();
        // Nope, application specific url is missing ...
        //if (!this.history) {
        //    this.history = new Backbone.Audit.StateChangeCollection({ target: this });
        //}
        return this.constructor.__super__.parse.apply(this, arguments);
    },

    /** Reset this entity model; silently clearing all properties, preserving entity ID. */
    _reset: function () {
        var id = this.id;
        this.clear({ silent: true });
        this.set(this.constructor.prototype.idAttribute, id, { silent: true });
    },

    isRewound: function () {
        return this.history.stateIndex < 0;
    },

    isDeleted: function () {
        return this.history.at(this.history.length - 1).isDelete();
    },

    /**
     * Client-side "rewinding" of the model state till given state change sequence number.
     * @param stateChangeSeqNumber One-based state change sequence number ordered by ascending timestamp
     */
    rewind: function (stateChangeSeqNumber) {
        var targetStateChangeSequenceNumber = parseInt(stateChangeSeqNumber),
            i = 0;

        this._reset();

        // Silently update model state with all state changes up till given state change sequence number
        for (; i < targetStateChangeSequenceNumber; i += 1) {
            var stateChangeModel = this.history.at(i);
            this.set(stateChangeModel.get("changes"), { silent: true });
        }

        this.history.stateIndex = targetStateChangeSequenceNumber - this.history.length;
        this.history.each(function (stateChange, zeroBasedIndex) {
            stateChange.set("seq", zeroBasedIndex += 1);
            if (this.isDeleted()) {
                // When deleted, all state changes are set to 'currentState: true' to avoid them being linked ...
                // TODO: Better solution ...
                stateChange.set("currentState", true);

            } else {
                if (stateChange.get("seq") === targetStateChangeSequenceNumber) {
                    stateChange.set("currentState", true);
                } else {
                    stateChange.set("currentState", false);
                }
            }
        }, this);

        // Finally, trigger a model state history "change"
        // Triggering change _in history collection_ to preserve last persistent model state
        // TODO: Yes, it's a bit strange ... Can we trigger a change on this model instead and get away with it?
        this.history.trigger("change");
    },

    update: function (allPossibleEditableAttributes) {
        var changedAttributes;
        if (this.isRewound()) {
            // If rewound (client side model is altered and cannot be used), use the server-side snapshot
            this._serverSideModel.set(allPossibleEditableAttributes);
            changedAttributes = this._serverSideModel.changedAttributes();
        } else {
            // If not, just use this model
            this.set(allPossibleEditableAttributes, { silent: true });
            changedAttributes = this.changedAttributes();
        }

        // If model has state changes, save the state changes/"diff" (server-side),
        // and then trigger a "change" event (client-side)
        if (changedAttributes) {
            var self = this,
                diffModel = new this.constructor();
            diffModel.clear();
            diffModel.set(this.constructor.prototype.idAttribute, this.id);
            diffModel.save(changedAttributes).done(function () {
                self.history.stateIndex = 0;
                self._serverSideModel = self.clone();
                self.trigger("change");
            });
        }
    },

    // TODO: Consider overriding the "Backbone.Model.destroy" method instead
    remove: function () {
        this.destroy({ wait: true });
    }
};
