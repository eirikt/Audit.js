var app = app || {};

app.BookCount = Backbone.Model.extend({
    url: "/api/bookcount"
});

app.Library = Backbone.Collection.extend({
    model: app.Book,
    url: "/api/books"
});

app.LibraryBookCountView = Backbone.View.extend({
    templateSelector: "#libraryBookCountTemplate",
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

// TODO: move all knowledge of index.html out into 'AppView' or 'MainView' plain JS class
app.LibraryBookListingView = Backbone.View.extend({
    //isDisabled: true,
    tableRowBookViews: [],
    initialize: function () {
        //console.log("Initializing new LibraryBookListingView ... with full data fetch!");
        this.isDisabled = true;
        this.collection.on("reset add", this.render, this);
        this.collection.fetch({ reset: true });
    },
    // Render a book by creating a BookView and appending the element it renders to the library's element
    renderBook: function (model, options) {
        var bookView = new app.TableRowBookView({
            model: model
        });
        //this.tableRowBookViews.push(bookView);
        $("#books").append(bookView.render().el);
    },
    // Render library by rendering each book in its collection
    render: function (options) {
        this.collection.each(function (model) {
            this.renderBook(model, options);
        }, this);

        // TODO: Bootstrap equivalent ...
        //this.$("#releaseDate").datepicker();

        this.trigger("rendered");
    },
    close: function () {
        this.collection.off();

        //_.each(this.tableRowBookViews, function (view) {
        //    view.close();
        //}, this);

        $("#books").find("> div").remove();

        //this.tableRowBookViews = [];
    },
    isActive: function () {
        return $("#collapseThree").hasClass("in");
    }
});
