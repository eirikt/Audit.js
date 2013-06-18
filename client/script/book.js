var app = app || {};

app.Book = Backbone.Model.extend({
    idAttribute: '_id',
    urlRoot: "/api/books",
    defaults: {
        title: null,
        author: null,
        releaseDate: null,
        //coverImage: 'image/placeholder.png',
        keywords: null,
        dateAdded: null
    }
});

app.BookInfoLineView = Backbone.View.extend({
    tagName: "tr",
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
