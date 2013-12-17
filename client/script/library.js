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
        count: 10
    },
    //pagination: {
    //    orderBy: null,
    //    count: null,
    //    currentIndex: null,
    //    currentCount: null
    //},
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


// TODO: make this view generic, put it in file 'backbone.bootstrap-pagination.js', introduce 'BootstrapPaginationButtonView'
app.BootstrapSimpleFourButtonPaginationView = Backbone.View.extend({
    numberOfPaginationButtons: 4,

    initialize: function (options) {
        this.paginatorAttributes = options || {};

        this.totalNumberOfBooks = this.paginatorAttributes.totalCount;
        this.numberOfBooksToShowOnEachPage = this.paginatorAttributes.count;

        this.numberOfPages = Math.ceil(this.totalNumberOfBooks / this.numberOfBooksToShowOnEachPage);

        this.currentIndex = this.paginatorAttributes.currentIndex;

        this.currentPage = null;
        if (this.currentIndex === 0) {
            this.currentPage = 1;
        } else if (this.currentIndex === (this.numberOfPages - 1) * this.numberOfBooksToShowOnEachPage) {
            this.currentPage = 4;
        }

        // Button #1 properties
        this.startIndexOnFirstPage = 0;
        this.numberOfBooksToShowOnFirstPage = this.numberOfBooksToShowOnEachPage;

        // Button #2 properties
        this.startIndexOnPreviousPage = this.currentIndex - this.numberOfBooksToShowOnEachPage;
        this.numberOfBooksToShowOnPreviousPage = this.numberOfBooksToShowOnEachPage;

        // Button #3 properties
        this.startIndexOnNextPage = this.currentIndex + this.numberOfBooksToShowOnEachPage;
        this.numberOfBooksToShowOnNextPage = this.numberOfBooksToShowOnEachPage;

        // Button #4 properties
        this.startIndexOnLastPage = (this.numberOfPages - 1) * this.numberOfBooksToShowOnEachPage;
        this.numberOfBooksToShowOnLastPage = this.totalNumberOfBooks - this.startIndexOnLastPage;
    },

    render: function () {
        this.$el.addClass("pagination").addClass("pagination-centered").append("<ul>");
        this.$("ul")
            .append("<li id='paginationLinkLi1' class='disabled'><a id='paginationLinkA1' href='#' title='First page' data-index='" + this.startIndexOnFirstPage + "' data-count='" + this.numberOfBooksToShowOnFirstPage + "' >&laquo;</a></li>")
            .append("<li id='paginationLinkLi2' class='disabled'><a id='paginationLinkA2' href='#' title='Previous page' data-index='" + this.startIndexOnPreviousPage + "' data-count='" + this.numberOfBooksToShowOnPreviousPage + "'>&lsaquo;</a></li>")
            .append("<li id='paginationLinkLi3' class='disabled'><a id='paginationLinkA3' href='#' title='Next page' data-index='" + this.startIndexOnNextPage + "' data-count='" + this.numberOfBooksToShowOnNextPage + "'>&rsaquo;</a></li>")
            .append("<li id='paginationLinkLi4' class='disabled'><a  id='paginationLinkA4' href='#' title='Last page' data-index='" + this.startIndexOnLastPage + "' data-count='" + this.numberOfBooksToShowOnLastPage + "'>&raquo;</a></li>");

        this.$("#paginationLinkA1, #paginationLinkA2,#paginationLinkA3, #paginationLinkA4").each(function () {
            $(this).off().on("click", function (event) {
                app.library.pagination.currentIndex = parseInt(event.target.dataset.index, 10);
                app.library.pagination.currentCount = parseInt(event.target.dataset.count, 10);
                app.library.fetch({ reset: true});
            });
        });

        if (this.currentPage) {
            switch (this.currentPage) {
                case 1:
                    this.$("#paginationLinkLi1").removeClass("disabled").addClass("active");
                    this.$("#paginationLinkLi2");
                    this.$("#paginationLinkLi3").removeClass("disabled");
                    this.$("#paginationLinkLi4").removeClass("disabled");
                    this.$("#paginationLinkA1, #paginationLinkA2").each(function () {
                        $(this).off().on("click", function (event) {
                            event.preventDefault();
                        });
                    });
                    break;
                case 4:
                    this.$("#paginationLinkLi1").removeClass("disabled");
                    this.$("#paginationLinkLi2").removeClass("disabled");
                    this.$("#paginationLinkLi3");
                    this.$("#paginationLinkLi4").removeClass("disabled").addClass("active");
                    this.$("#paginationLinkA3, #paginationLinkA4").each(function () {
                        $(this).off().on("click", function (event) {
                            event.preventDefault();
                        });
                    });
                    break;
            }
        } else {
            this.$("#paginationLinkLi1").removeClass("disabled");
            this.$("#paginationLinkLi2").removeClass("disabled");
            this.$("#paginationLinkLi3").removeClass("disabled");
            this.$("#paginationLinkLi4").removeClass("disabled");
        }

        return this;
    }
});


app.BookListTableView = Backbone.View.extend({
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
    _renderPaginator: function () {
        var paginator = new app.BootstrapSimpleFourButtonPaginationView(this.collection.pagination).render();
        this.$el.prepend(paginator.el);
    },
    _renderBook: function (model) {
        if (this.isVisible()) {
            var book = new app.BookInfoTableRowView({ model: model }).render();
            this.$("tbody").append(book.el);
        }
    },
    render: function () {
        this.$el.empty().append($("#bookListTableTemplate").html());
        if (this.collection.pagination) {
            this._renderPaginator();
        }
        // TODO: ugh, ugly - proper functional style, please
        this.collection.each(function (model) {
            this._renderBook(model);
        }, this);
    },
    close: function () {
        this.$("tr").remove();
    }
});
