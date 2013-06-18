var app = app || {};

app.BookCount = Backbone.Model.extend({
    default: {
        count: 0
    },
    url: "/api/bookcount"
});

app.Library = Backbone.Collection.extend({
    model: app.Book,
    url: "/api/books",
    comparator: function (book) {
        //return - book.get("dateAdded").getTime();
        return book.get("seq");
    }
});

app.BookCountView = Backbone.View.extend({
    templateSelector: "#bookCountTemplate",
    initialize: function () {
        this.model.on("change", this.render, this);
        this.model.fetch({
            error: function (err) {
                alert(err);
            }
        });
    },
    render: function () {
        this.$el.html(_.template($(this.templateSelector).html(), { count: this.model.get("count") }));
        this.trigger("rendered");
    },
    close: function () {
        this.$el.remove();
    }
});

app.BookListingView = Backbone.View.extend({
    initialize: function () {
        this.listenTo(this.collection, "reset", this.render);
        this.listenTo(this.collection, "add", this.renderBook);
        if (this.isActive()) {
            this.collection.fetch({ reset: true });
        }
    },
    // Render a book by creating a BookView and appending the element it renders to the library's element
    renderBook: function (model) {
        var bookView = new app.BookInfoLineView({
            model: model
        });
        this.$("#books").prepend(bookView.render().el);
        this.trigger("bookRendered");
    },
    // Render library by rendering each book in its collection
    render: function () {
        this.$el.html($("#bookListingLineTemplate").html());

        this.collection.each(function (model) {
            this.renderBook(model);
        }, this);

        // TODO: Bootstrap equivalent ...
        //this.$("#releaseDate").datepicker();

        this.trigger("rendered");
    },
    close: function () {
        this.$("div").remove();
    },
    isActive: function () {
        return this.$el.parent("div").hasClass("in");
    }
});

app.BookListingTableView = Backbone.View.extend({
    initialize: function () {
        this.listenTo(this.collection, "reset", this.render);
        this.listenTo(this.collection, "add", this.renderBook);
        if (this.isActive()) {
            this.collection.fetch({ reset: true });
        }
    },
    renderBook: function (model) {
        var bookView = new app.BookInfoTableRowView({
            model: model
        });
        this.$("tbody").prepend(bookView.render().el);
        this.trigger("bookRendered");
    },
    render: function () {
        this.$el.html($("#bookListingTableTemplate").html());

        this.collection.each(function (model) {
            this.renderBook(model);
        }, this);

        this.trigger("rendered");
    },
    close: function () {
        this.$("tr").remove();
    },
    isActive: function () {
        return this.$el.parent("div").hasClass("in");
    }
});
