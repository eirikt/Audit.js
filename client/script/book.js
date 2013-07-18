var app = app || {};

app.Book = Backbone.Model.extend({
    idAttribute: '_id',
    urlRoot: "/api/books",
    defaults: {
        title: null,
        author: null,
        releaseDate: null,
        //coverImage: 'image/placeholder.png',
        keywords: null
    }
});

// TODO: must be declared here (and not in the more appropriate location 'app.js') ... why?
app.StateChange = Backbone.Model.extend({
    idAttribute: '_id'
});

app.BookHistory = Backbone.Collection.extend({
    model: app.StateChange,
    initialize: function (options) {
        if (options && options.entityId) {
            this.entityId = options.entityId;
        }
    },
    url: function () {
        return this.entityId ? "/api/admin/statechanges/" + this.entityId : "/api/admin/statechanges";
    }
});

app.BookInfoLineView = Backbone.View.extend({
    templateSelector: "#bookInfoLineTemplate",
    template: null,
    model: null,
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    }
});

app.BookInfoTableRowView = Backbone.View.extend({
    tagName: "tr",
    templateSelector: "#bookInfoTableRowTemplate",
    template: null,
    model: null,
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    }
});

app.BookCompositeView = Backbone.View.extend({
    model: null,
    bookHistoryCollection: null,
    bookView: null,
    bookHistoryView: null,

    render: function () {
        // Recreate/refresh the library (book collection)
        this.stopListening(this.bookHistoryCollection, "reset");
        this.bookHistoryCollection = new app.BookHistory({ entityId: this.model.id });

        // Recreate/refresh the views
        if (this.bookView) {
            this.bookView.remove();
        }
        if (this.bookHistoryView) {
            this.bookHistoryView.remove();
        }
        this.bookView = new app.BookView({ parentView: this, model: this.model });
        this.bookHistoryView = new app.BookHistoryView({ parentView: this, collection: this.bookHistoryCollection });
        this.$el.empty().append(this.bookView.el).append(this.bookHistoryView.el);

        // The model is probably changed from outside, update counter views and refresh the book listing view when changed
        this.listenTo(this.model, "change destroy", app.refresh);

        // The model is probably changed from outside, clear the book form view when deleted
        this.listenTo(this.model, "destroy", _.bind(this.bookView.reset, this.bookView));

        // The model is probably changed from outside, update book history view when changed
        this.listenTo(this.model, "change destroy", _.bind(this.bookHistoryCollection.fetch, this.bookHistoryCollection, { reset: true }));
        this.listenTo(this.bookHistoryCollection, "reset", _.bind(this.bookHistoryView.render, this.bookHistoryView));

        // Render the composite views
        this.bookView.render();
        this.bookHistoryCollection.fetch({ reset: true });
    }
});

app.BookView = Backbone.View.extend({
    templateSelector: "#bookTemplate",
    formSelector: "#editBook",
    template: null,
    model: null,
    events: {
        "click #updateBook": "_updateBook",
        "click #deleteBook": "_deleteBook"
    },
    initialize: function (options) {
        if (options && options.parentView) {
            this.parentView = options.parentView;
        }
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    },
    reset: function () {
        resetFormInputFields(this.$(this.formSelector));
        this.$("span.label").remove();
        this.$("button").attr("disabled", "disabled");
    },
    _getFormFields: function () {
        return this.$("div").children("input");
    },
    _isEditableField: function (fieldId) {
        return !_.isEmpty(fieldId) && fieldId !== "seq";
    },
    _isFieldEligibleForChange: function ($el) {
        return this._isEditableField($el.id) && !_($el.value).isEmpty();
    },
    _getFormInputFields: function (filterFunc) {
        var isFieldEligibleForChange = filterFunc || function () {
            return true;
        };
        return  _.object(_.compact(_.map(this._getFormFields(), function ($inputEl) {
            if (isFieldEligibleForChange($inputEl)) {
                return [$inputEl.id, $inputEl.value];
            } else {
                return null;
            }
        })));
    },
    _updateBook: function (event) {
        event.preventDefault();

        // Silently update model (client-side) with all form values
        this.model.set(this._getFormInputFields(_.bind(this._isFieldEligibleForChange, this)), { silent: true });

        var self = this,
            changedAttributes = this.model.changedAttributes();

        // If model has state changes, save it (server-side), and then trigger a "change" event for the model (client-side)
        if (changedAttributes) {
            var diffModel = new app.Book();
            diffModel.clear();
            diffModel.set(app.Book.prototype.idAttribute, this.model.id);
            diffModel.save(changedAttributes).done(function () {
                self.model.trigger("change");
            });
        }
    },
    _deleteBook: function (event) {
        event.preventDefault();
        this.model.destroy({ wait: true });
    }
});

app.BookHistoryView = Backbone.View.extend({
    templateSelector: "#bookHistoryTemplate",
    initialize: function (options) {
        if (options && options.parentView) {
            this.parentView = options.parentView;
        }
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template());
        this.collection.each(function (bookEvent) {
            var bookView = new app.BookHistoryEventView({ model: bookEvent });
            this.$("tbody").prepend(bookView.render().el);
        }, this);
    }
});

app.BookHistoryEventView = Backbone.View.extend({
    tagName: "tr",
    templateSelector: "#bookHistoryEventTemplate",
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        var modelAttributes = this.model.toJSON();
        var changes = modelAttributes.changes;
        delete modelAttributes.changes;
        modelAttributes.changes = JSON.stringify(changes);

        this.$el.html(this.template(modelAttributes));
        return this;
    }
});
