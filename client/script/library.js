var app = app || {};

app.BookCountQuery = Backbone.Model.extend({
    defaults: { titleSubstring: "", authorSubstring: "", keywords: null, count: 0 },
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
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.model, "sync change", this.render);
        //this.model.fetch();
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        this.trigger("rendered");
    }
});


app.BookSearchView = Backbone.View.extend({
    templateSelector: "#bookSearchTemplate",
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.model, "change", this.render);
    },
    render: function () {
        var self = this;
        this.$el.html(this.template(this.model.toJSON()));
        this.trigger("rendered");

        this.$("#titleSubstring").off().bindWithDelay("keyup", function () {
            self.model.save("titleSubstring", self.$("#titleSubstring").val()).done(function () {
                var $titleSearch = self.$("#titleSubstring");
                $titleSearch.focus().val($titleSearch.val());
            });
        }, 400);

        this.$("#authorSubstring").off().bindWithDelay("keyup", function () {
            self.model.save("authorSubstring", self.$("#authorSubstring").val()).done(function () {
                var $authorSearch = self.$("#authorSubstring");
                $authorSearch.focus().val($authorSearch.val());
            });
        }, 400);
    }
});


app.BookInfoTableRowView = Backbone.View.extend({
    tagName: "tr",
    templateSelector: "#bookInfoTableRowTemplate",
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
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
