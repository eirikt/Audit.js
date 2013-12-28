var app = app || {};


app.BookCountQuery = Backbone.Model.extend({
    defaults: { titleSubstring: "", authorSubstring: "", keywords: null, count: 0 },
    urlRoot: "/library/books/count"
});


/**
 * Both a model and a view-model ...
 */
app.Library = Backbone.Collection.extend({
    url: "/library/books/projection",
    model: app.Book,
    totalBookCount: 0,
    defaultPagination: {
        orderBy: null,                            // Not yet supported ...
        count: app.LIBRARY_PAGINATION_SIZE,       // Overall number of books for each page / Pagination flag
        currentIndex: 0,                          // Overall book index
        currentCount: app.LIBRARY_PAGINATION_SIZE // Number of books on current page
    },
    defaultFiltering: {
        titleSubstring: null,
        authorSubstring: null,
        keywords: null,
        count: 0,           // ...
        totalCount: 0       // ...
    },
    initialize: function (options) {
        this.pagination = this.defaultPagination;
        this.pagination.count = app.LIBRARY_PAGINATION_SIZE;        // Overall number of books for each page / Pagination flag
        this.pagination.currentCount = app.LIBRARY_PAGINATION_SIZE; // Overall number of books for each page / Pagination flag
        if (!options || options && (!options.pagination || options.pagination === false)) {
            this.pagination = false;
        }

        this.filtering = this.defaultFiltering;
        if (!options || options && (!options.filtering || options.filtering === false)) {
            this.filtering = false;
        }
    },
    _fetchByPOST: function () {
        return Backbone.Collection.prototype.fetch.call(this,{
            url: this.url,
            reset: true,
            type: "POST",
            data: $.param({
                count: this.pagination.count,
                index: this.pagination.currentIndex,
                titleSubstring: this.filtering.titleSubstring,
                authorSubstring: this.filtering.authorSubstring
            })
        });
    },
    fetch: function () {
        this._fetchByPOST();
    },
    parse: function (response) {
        this.totalBookCount = response.totalCount;
        this.filtering.totalCount = response.count;
        return response.books;
    },
    // Client-side sorting of book collection
    comparator: function (book) {
        return book.get("seq"); // Ascending (auto-generated) sequence number
    },
    hasFiltering: function () {
        return this.filtering;
    },
    isFiltered: function () {
        return this.filtering.titleSubstring || this.filtering.authorSubstring;
    },
    isEligibleForPagination: function () {
        return this.pagination && this.filtering.totalCount > this.pagination.count;
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


app.BookCountView2 = Backbone.View.extend({
    templateSelector: "#bookCountTemplate2",
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
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
            new app.BookCountQuery().save("titleSubstring", self.$("#titleSubstring").val()).done(function () {
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


app.BookInfoTableFilteringRowView = Backbone.View.extend({
    tagName: "tr",
    templateSelector: "#bookInfoTableFilteringRowTemplate",
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
    },
    render: function () {
        this.$el.html(this.template(this.model.toJSON()));
        return this;
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
    templateSelector: "#bookListTableTemplate",
    initialize: function () {
        this.template = _.template($(this.templateSelector).html());
        this.listenTo(this.collection, "reset", this.render);
        this.listenTo(this, "reset", this.render);
    },
    isVisible: function () {
        return this.$el.parent("div").hasClass("in");
    },
    _removeBook: function (book) {
        throw new Error("Not yet implemented");
    },
    _renderBookCounter: function () {
        var counter = new app.BookCountView2({
            model: new Backbone.Model({
                bookCount: this.collection.filtering.totalCount
            })
        });
        this.$el.prepend(counter.render().el);
    },
    _renderPagination: function () {
        var paginationView = new BootstrapSimpleFourButtonPaginationView({
            model: new Backbone.Model({
                count: this.collection.filtering.totalCount,
                currentIndex: this.collection.pagination.currentIndex,
                pageCount: this.collection.pagination.count
            })
        });
        this.$el.prepend(paginationView.render().el);

        var self = this;
        this.listenTo(paginationView, "pagination", function (index, count) {
            self.collection.pagination.currentIndex = index;
            self.collection.pagination.currentCount = count;
            self.collection.fetch();
        });
    },
    _renderFiltering: function () {
        var filteringRow = new app.BookInfoTableFilteringRowView({
            model: new Backbone.Model(this.collection.filtering)
        });
        this.$("tbody").append(filteringRow.render().el);
    },
    _renderBook: function (model) {
        var bookRow = new app.BookInfoTableRowView({ model: model });
        this.$("tbody").append(bookRow.render().el);
    },
    render: function () {
        if (this.isVisible()) {
            var self = this;
            this.$el.empty().append(this.template());
            if (this.collection.isEligibleForPagination()) {
                this._renderPagination();
            }
            if (this.collection.hasFiltering()) {
                if (this.collection.totalBookCount > 0) {
                    this._renderFiltering();
                    if (this.collection.isFiltered()) {
                        this._renderBookCounter();
                    }
                }
            }
            // TODO: ugh, ugly - proper functional style, please ...
            this.collection.each(function (model) {
                this._renderBook(model);
            }, this);

            this.$("#titleSubstring").off().bindWithDelay("keyup", function () {
                var $el = $(this);
                self.collection.filtering.titleSubstring = $el.val();
                self.collection.pagination.currentIndex = 0; // "reset" book table
                self.collection.fetch().done(function () {
                    self.$("#titleSubstring").focus().val($el.val());
                });
            }, app.KEYUP_TRIGGER_DELAY_IN_MILLIS);

            this.$("#authorSubstring").off().bindWithDelay("keyup", function () {
                var $el = $(this);
                self.collection.filtering.authorSubstring = $el.val();
                self.collection.pagination.currentIndex = 0; // "reset" book table
                self.collection.fetch().done(function () {
                    self.$("#authorSubstring").focus().val($el.val());
                });
            }, app.KEYUP_TRIGGER_DELAY_IN_MILLIS);
        }
        return this;
    },
    close: function () {
        this.$("tr").remove();
    }
});
