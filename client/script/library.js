var app = app || {};

app.BookCountQuery = Backbone.Model.extend({
    default: { count: 0 },
    url: "/api/bookcount"
});

app.Library = Backbone.Collection.extend({
    model: app.Book,
    url: "/api/books",
    // Client-side sorting of book collection
    comparator: function (book) {
        //return - book.get("dateAdded").getTime();
        return book.get("seq");
    }
});

app.BookCountView = Backbone.View.extend({
    templateSelector: "#bookCountTemplate",
    template: null,
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.model, "change", this.render);
        this.model.fetch();
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        this.trigger("rendered");
    }
});

app.BookListingTableView = Backbone.View.extend({
    initialize: function () {
        // TODO: The goal?
        //this.listenTo(this.collection, "reset", this.render);
        //this.listenTo(this.collection, "remove", this._removeBook);
        //this.listenTo(this.collection, "add", this._renderBook);

        this.listenTo(this.collection, "reset add remove", this.render);
        // TODO: Necessary?
        //if (this.isVisible()) {
        //    this.collection.fetch({ reset: true });
        //}
    },
    isVisible: function () {
        return this.$el.parent("div").hasClass("in");
    },
    _removeBook: function (book) {
        throw new Error("Not yet implemented");
    },
    _renderBook: function (model) {
        if (this.isVisible()) {
            var bookView = new app.BookInfoTableRowView({ model: model });
            this.$("tbody").prepend(bookView.render().el);
            this.trigger("bookRendered");
        }
    },
    render: function () {
        this.$el.html($("#bookListingTableTemplate").html());

        this.collection.each(function (model) {
            this._renderBook(model);
        }, this);

        this.trigger("rendered");
    },
    close: function () {
        this.$("tr").remove();
    }
});
