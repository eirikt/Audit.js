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
    }
});

app.LibraryBookListingView = Backbone.View.extend({
    templateSelector: "#libraryBookListingTemplate",
    initialize: function () {
    },
    render: function () {
    }
});
