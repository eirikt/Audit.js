var app = app || {};


app.BookCountQuery = Backbone.Model.extend({
    defaults: { titleSubstring: "", authorSubstring: "", keywords: null, count: 0 },
    urlRoot: "/library/books/count"
});


/**
 * Both a model and a view-model ...
 */
app.Library = Backbone.Collection.extend({
    uri: "/library/books",
    model: app.Book,
    defaultPagination: {
        orderBy: null, // Not yet supported ...
        count: 10,
        currentIndex: null,
        currentCount: null
    },
    initialize: function (options) {
        this.pagination = options ? options.pagination : false;
        if (this.pagination &&
            _.isBoolean(this.pagination) || _.isObject(this.pagination)) {
            this.pagination = this.defaultPagination;
            this.pagination.currentIndex = 0;                     // Default/start value
            this.pagination.currentCount = this.pagination.count; // Default/start value
        }
    },
    url: function () {
        var url = this.uri;
        if (this.pagination) {
            url += "?";
            url += "orderBy=" + this.pagination.orderBy;
            url += "&";
            url += "count=" + this.pagination.currentCount;
            url += "&";
            url += "index=" + this.pagination.currentIndex;
        }
        return url;
    },
    parse: function (response) {
        if (this.pagination) {
            this.pagination.totalCount = response.count;
        }
        return response.books;
    },
    // Client-side sorting of book collection
    comparator: function (book) {
        return book.get("seq"); // Ascending (auto-generated) sequence number
    },
    isEligibleForPagination: function () {
        return this.pagination && this.pagination.totalCount > this.pagination.count;
    }
});


app.BookCountView = Backbone.View.extend({
    templateSelector: "#bookCountTemplate",
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.model, "sync change", this.render);
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
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
        }, app.KEYUP_TRIGGER_DELAY_IN_MILLIS);

        this.$("#authorSubstring").off().bindWithDelay("keyup", function () {
            self.model.save("authorSubstring", self.$("#authorSubstring").val()).done(function () {
                var $authorSearch = self.$("#authorSubstring");
                $authorSearch.focus().val($authorSearch.val());
            });
        }, app.KEYUP_TRIGGER_DELAY_IN_MILLIS);
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


app.BookListTableView = Backbone.View.extend({
    paginationView: null,
    initialize: function () {
        // TODO: The goal?
        //this.listenTo(this.collection, "reset", this.render);
        //this.listenTo(this.collection, "remove", this._removeBook);
        //this.listenTo(this.collection, "add", this._renderBook);

        //this.listenTo(this.collection, "reset add remove", this.render);
        this.listenTo(this.collection, "reset", this.render);
    },
    isVisible: function () {
        return this.$el.parent("div").hasClass("in");
    },
    _removeBook: function (book) {
        throw new Error("Not yet implemented");
    },
    _renderPagination: function () {
        this.paginationView = new BootstrapSimpleFourButtonPaginationView(this.collection.pagination);
        this.$el.prepend(this.paginationView.render().el);
        this.listenTo(this.paginationView, "pagination", function (index, count) {
            app.library.pagination.currentIndex = index;
            app.library.pagination.currentCount = count;
            app.library.fetch({ reset: true});
        });
    },
    _renderBook: function (model) {
        if (this.isVisible()) {
            var book = new app.BookInfoTableRowView({ model: model }).render();
            this.$("tbody").append(book.el);
        }
    },
    render: function () {
        this.$el.empty().append($("#bookListTableTemplate").html());
        if (this.collection.isEligibleForPagination()) {
            this._renderPagination();
        }
        // TODO: ugh, ugly - proper functional style, please ...
        this.collection.each(function (model) {
            this._renderBook(model);
        }, this);
    },
    close: function () {
        this.$("tr").remove();
    }
});
