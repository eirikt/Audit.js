BootstrapPaginationButtonView = Backbone.View.extend({
    tagName: "li",
    className: "disabled",
    initialize: function (attr) {
        this.paginationContainer = attr.paginationContainer;
        this.index = attr.index;
        this.title = attr.title;
        this.content = attr.content;
        this.bookIndex = attr.bookIndex;
        this.bookCount = attr.bookCount;
    },
    render: function () {
        var self = this,
            a = $("<a>")
                .attr("id", "paginationLinkA" + this.index)
                .attr("href", "#")
                .attr("title", this.title)
                .attr("data-index", this.bookIndex)
                .attr("data-count", this.bookCount)
                .append(this.content);

        this.$el.attr("id", "paginationLinkLi" + this.index);
        this.$el.append(a);
        a.off().on("click", function (event) {
            self.paginationContainer.trigger(
                "pagination",
                parseInt(event.target.dataset.index, 10),
                parseInt(event.target.dataset.count, 10))
        });
        return this;
    },
    activate: function () {
        this.$el.removeClass("disabled");
    },
    deactivate: function () {
        this.$("a").off().on("click", function (event) {
            event.preventDefault();
        });
    },
    selectAndDeactivate: function () {
        this.$el.removeClass("disabled").addClass("active");
        this.deactivate();
    }
});


BootstrapSimpleFourButtonPaginationView = Backbone.View.extend({
    tagName: "div", // For clarity
    className: "pagination pagination-centered",
    numberOfPaginationButtons: 4,

    initialize: function (attr) {
        this.paginationAttributes = attr || {};

        this.totalNumberOfBooks = this.paginationAttributes.totalCount;
        this.numberOfBooksToShowOnEachPage = this.paginationAttributes.count;

        this.numberOfPages = Math.ceil(this.totalNumberOfBooks / this.numberOfBooksToShowOnEachPage);

        this.currentIndex = this.paginationAttributes.currentIndex;

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
        var button1 = new BootstrapPaginationButtonView({ paginationContainer: this, index: 1, title: "First page", content: "«", bookIndex: this.startIndexOnFirstPage, bookCount: this.numberOfBooksToShowOnFirstPage });
        var button2 = new BootstrapPaginationButtonView({ paginationContainer: this, index: 2, title: "Previous page", content: "‹", bookIndex: this.startIndexOnPreviousPage, bookCount: this.numberOfBooksToShowOnPreviousPage });
        var button3 = new BootstrapPaginationButtonView({ paginationContainer: this, index: 3, title: "Next page", content: "›", bookIndex: this.startIndexOnNextPage, bookCount: this.numberOfBooksToShowOnNextPage });
        var button4 = new BootstrapPaginationButtonView({ paginationContainer: this, index: 4, title: "Last page", content: "»", bookIndex: this.startIndexOnLastPage, bookCount: this.numberOfBooksToShowOnLastPage });

        this.$el.append("<ul>");
        this.$("ul").append(button1.render().el).append(button2.render().el).append(button3.render().el).append(button4.render().el);

        if (this.currentPage) {
            switch (this.currentPage) {
                case 1:
                    button1.selectAndDeactivate();
                    button2.deactivate();
                    button3.activate();
                    button4.activate();
                    break;
                case 4:
                    button1.activate();
                    button2.activate();
                    button3.deactivate();
                    button4.selectAndDeactivate();
                    break;
            }
        } else {
            button1.activate();
            button2.activate();
            button3.activate();
            button4.activate();
        }
        return this;
    }
});
