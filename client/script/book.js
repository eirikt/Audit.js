// http://stackoverflow.com/questions/680241/resetting-a-multi-stage-form-with-jquery
function resetFormInputFields($form) {
    $form.find("input:text, input:password, input:file, select, textarea").val("");
    $form.find("input:radio, input:checkbox").removeAttr("checked").removeAttr("selected");
}

function disableFormInputFields($form) {
    $form.find("input:text, input:password, input:file, select, textarea").attr("disabled", "disabled");
}


var app = app || {};

app.Book = Backbone.Model.extend({
    idAttribute: "_id",
    urlRoot: "/library/books",
    defaults: {
        title: null,
        author: null,
        releaseDate: null,
        //coverImage: 'image/placeholder.png',
        keywords: null
    }
});
// Make the book state-change aware
_.extend(app.Book.prototype, Backbone.Audit.History);

app.BookHistory = Backbone.Audit.StateChangeCollection.extend({
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

app.BookCompositeView = Backbone.View.extend({
    model: null,
    bookView: null,
    bookHistoryView: null,

    isVisible: function () {
        return this.$el.parent("div").hasClass("in");
    },
    render: function () {
        // Show view if not already visible
        if (!this.isVisible()) {
            $("#bookDetails").click();
        }

        // Recreate/refresh the composite views
        if (this.bookView) {
            this.bookView.remove();
        }
        if (this.bookHistoryView) {
            this.bookHistoryView.remove();
        }
        this.bookView = new app.BookView({ parentView: this, model: this.model });
        this.bookHistoryView = new app.BookHistoryView({ parentView: this, model: this.model });
        this.$el.empty().append(this.bookView.el).append(this.bookHistoryView.el);

        Backbone.listenTo(this.model, "destroy", _.bind(this.bookView.reset, this.bookView));
        Backbone.listenTo(this.model, "change destroy", _.bind(this.model.history.fetch, this.model.history, { reset: true }));
        Backbone.listenTo(this.model.history, "change", _.bind(this.bookView.render, this.bookView));
        Backbone.listenTo(this.model.history, "reset change", _.bind(this.bookHistoryView.render, this.bookHistoryView));

        // Render the composite views
        this.bookView.render();
        this.model.history.fetch({ reset: true });
    },
    reset: function () {
        if (this.bookView) {
            this.bookView.reset();
        }
        if (this.bookHistoryView) {
            this.bookHistoryView.reset();
        }
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
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    },
    reset: function () {
        disableFormInputFields(this.$(this.formSelector));
        this.$("button").attr("disabled", "disabled");
    },
    _isEditableField: function (fieldId) {
        return !_.isEmpty(fieldId) && fieldId !== "seq";
    },
    _isFieldEligibleForEditing: function ($el) {
        return this._isEditableField($el.id) && !_($el.value).isEmpty();
    },
    _getFormInputFieldsAsObjectProperties: function (filterFunc) {
        var isFieldEligibleForEditing = filterFunc || function () {
            return true;
        };
        return  _.chain(this.$("div").children("input"))
            .map(function ($inputEl) {
                return (isFieldEligibleForEditing($inputEl)) ? [$inputEl.id, $inputEl.value] : null;
            })
            .compact()  // Remove nulls
            .object()   // Arrays to object properties
            .value();
    },
    _updateBook: function (event) {
        event.preventDefault();
        var editableAttributes = this._getFormInputFieldsAsObjectProperties(_.bind(this._isFieldEligibleForEditing, this));
        this.model.update(editableAttributes);
    },
    _deleteBook: function (event) {
        event.preventDefault();
        this.model.remove();
    }
});

app.BookHistoryView = Backbone.View.extend({
    templateSelector: "#bookHistoryTemplate",
    template: null,
    model: null,
    events: {
        "click .state": "replayToState"
    },
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template());
        this.model.history.each(function (stateChange) {
            var bookView = new app.BookHistoryEventView({ model: stateChange });
            this.$("tbody").prepend(bookView.render().el);
        }, this);
        return this;
    },
    reset: function () {
        this.model.history.fetch({ reset: true });
    },
    replayToState: function (event) {
        event.preventDefault();
        var elementDataSet = event.target.dataset;
        this.model.rewind(elementDataSet.seq);
    }
});

app.BookHistoryEventView = Backbone.View.extend({
    tagName: "tr",
    templateSelector: "#bookHistoryEventTemplate",
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    _getRelativeTimeDescription: function (timestamp) {
        return moment(timestamp).fromNow();
    },
    render: function () {
        var clonedAttributes = this.model.toJSON();

        // Make a nice "how-many-hours-since" human readable timestamp
        clonedAttributes.timestamp = this._getRelativeTimeDescription(clonedAttributes.timestamp);

        // All attribute levels must be cloned before manipulation
        clonedAttributes.changes = _.clone(clonedAttributes.changes);

        // Only "create"/"update" events have "changes" content
        if (this.model.isCreate() || this.model.isUpdate()) {

            // Remove the book sequence number "seq" (internal, not human readable)
            delete clonedAttributes.changes.seq;

            // Make the keyword property human readable (recursive flattening/"stringification")
            if (clonedAttributes.changes.keywords) {
                var keywords = _.clone(clonedAttributes.changes.keywords);
                delete clonedAttributes.changes.keywords;
                clonedAttributes.changes.keywords = _.map(keywords, function (keywordObj) {
                    return keywordObj.keyword;
                });
            }
        }
        // Default "changes" behaviour: Just stringify the changes properties to be human readable
        clonedAttributes.changes = JSON.stringify(clonedAttributes.changes);

        this.$el.html(this.template(clonedAttributes));
        return this;
    }
});
