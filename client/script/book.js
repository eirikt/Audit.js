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
    },
    close: function () {
        this.$el.remove();
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
    //getContent: function () {
    //    this.model.set("id", this.model.id, { silent: true });
    //    return this.template(this.model.toJSON());
    //},
    render: function () {
        //this.$el.html(this.getContent());
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    },
    close: function () {
        this.$el.remove();
    }
});

app.BookView = Backbone.View.extend({
    templateSelector: "#bookTemplate",
    formSelector: "#editBook",
    template: null,
    model: null,
    events: {
        "click #updateBook": "updateBook",
        "click #deleteBook": "deleteBook"
    },
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
    },
    reset: function () {
        resetFormInputFields(this.$(this.formSelector));
        this.$("span.label").remove();
        this.$("button").attr("disabled","disabled");
    },
    close: function () {
        this.$el.remove();
    },
    isEditableField: function (fieldId) {
        return !_.isEmpty(fieldId) && fieldId !== "seq";
    },
    updateBook: function (event) {
        event.preventDefault();

        var self = this;
        var formData = {};
        this.$("div").children("input").each(function (i, $el) {
            if (self.isEditableField($el.id) && $el.value !== "") {
                formData[$el.id] = $el.value;
            }
        });
        this.model.set(formData);

        var diffModel = new app.Book();
        diffModel.clear();
        diffModel.set(app.Book.prototype.idAttribute, this.model.id);
        diffModel.save(this.model.changedAttributes()).done(function () {
            app.refresh();
        });
    },
    deleteBook: function (event) {
        event.preventDefault();
        this.model.destroy();
        this.reset();
        app.refresh();
    }
});
