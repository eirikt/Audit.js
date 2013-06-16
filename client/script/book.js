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

app.TableRowBookView = Backbone.View.extend({
    //tagName: "tr",
    templateSelector: "#tableRowBookTemplate",
    template: null,

    initialize: function () {
        this.template = _.template($(this.templateSelector).html(), null);
    },
    getContent: function () {
        this.model.set("id", this.model.id, { silent: true });
        return this.template(this.model.toJSON());
    },
    render: function () {
        // this.el is what we defined in tagName. use $el to get access to jQuery html() function
        this.$el.html(this.getContent());

        return this;
    },
    close: function () {
        this.$el.remove();
    }
});
