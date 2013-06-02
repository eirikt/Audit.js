var app = app || {};

app.BookCount = Backbone.Model.extend({
    url: "/api/bookcount"
});

app.Library = Backbone.Collection.extend({
    model: app.Book,
    url: "/api/books"
});

app.LibrarySummaryView = Backbone.View.extend({
    templateEl: "#libraryBookCountTemplate",
    initialize: function () {
        this.listenTo(this.model, "change", this.render);
        this.model.fetch({
            error: function (err) {
                alert(err);
            }
        });
    },
    render: function () {
        this.$el.html(_.template($(this.templateEl).html(), { count: this.model.get("count") }));
        this.trigger("rendered");
    }
});
