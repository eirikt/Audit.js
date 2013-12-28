/**
 * ...
 *
 * This view is expecting a model with:
 * <ul>
 *     <li/><code>seq</code>: the pagination button sequence number
 *     <li/><code>title</code>: ...
 *     <li/><code>index</code>: ...
 *     <li/><code>count</code>: ...
 *     <li/><code>content</code>: ...
 * </ul>
 * @see http://getbootstrap.com/2.3.2/components.html#pagination
 */
// TODO: upgrade Bootstrap version
BootstrapPaginationButtonView = Backbone.View.extend({
    tagName: "li",
    className: "disabled",
    render: function () {
        var self = this,
            a = $("<a>")
                .attr("id", "paginationLinkA" + self.model.get("seq"))
                .attr("href", "#")
                .attr("title", self.model.get("title"))
                .attr("data-index", self.model.get("index"))
                .attr("data-count", self.model.get("count"))
                .append(self.model.get("content"));

        self.$el.attr("id", "paginationLinkLi" + self.model.get("seq"));
        self.$el.append(a);
        a.off().on("click", function (event) {
            self.trigger(
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


/**
 * Simple pagination with four static buttons, first, previous, next, and last.
 * It is based on Bootstrap v2.3.2
 *
 * This view is expecting a model with:
 * <ul>
 *     <li/><code>count</code>: the total number of elements in the list
 *     <li/><code>pageCount</code>: the number of elements to show on each page
 *     <li/><code>currentIndex</code>: the index of the first book on the current page
 * </ul>
 * @see http://getbootstrap.com/2.3.2/components.html#pagination
 */
// TODO: upgrade Bootstrap version
BootstrapSimpleFourButtonPaginationView = Backbone.View.extend({
    tagName: "div", // For clarity
    className: "pagination pagination-centered",

    initialize: function () {
        this.totalNumberOfElements = this.model.get("count");
        this.pageIndex = this.model.get("currentIndex");
        this.numberOfElementsToShowOnEachPage = this.model.get("pageCount");

        this.numberOfPages = Math.ceil(this.totalNumberOfElements / this.numberOfElementsToShowOnEachPage);

        this.currentPage = null;
        if (this.pageIndex === 0) {
            this.currentPage = 1;
        } else if (this.pageIndex === (this.numberOfPages - 1) * this.numberOfElementsToShowOnEachPage) {
            this.currentPage = 4;
        }

        // Button #1 properties
        this.startIndexOnFirstPage = 0;
        this.numberOfElementsToShowOnFirstPage = this.numberOfElementsToShowOnEachPage;

        // Button #2 properties
        this.startIndexOnPreviousPage = this.pageIndex - this.numberOfElementsToShowOnEachPage;
        this.numberOfElementsToShowOnPreviousPage = this.numberOfElementsToShowOnEachPage;

        // Button #3 properties
        this.startIndexOnNextPage = this.pageIndex + this.numberOfElementsToShowOnEachPage;
        this.numberOfElementsToShowOnNextPage = this.numberOfElementsToShowOnEachPage;

        // Button #4 properties
        this.startIndexOnLastPage = (this.numberOfPages - 1) * this.numberOfElementsToShowOnEachPage;
        this.numberOfElementToShowOnLastPage = this.totalNumberOfElements - this.startIndexOnLastPage;
    },

    render: function () {
        var self = this,
            button1 = new BootstrapPaginationButtonView({
                model: new Backbone.Model({
                    seq: 1,
                    title: "First page",
                    content: "«",
                    index: this.startIndexOnFirstPage,
                    count: this.numberOfElementsToShowOnFirstPage
                })
            }),
            button2 = new BootstrapPaginationButtonView({
                model: new Backbone.Model({
                    seq: 2,
                    title: "Previous page",
                    content: "‹",
                    index: this.startIndexOnPreviousPage,
                    count: this.numberOfElementsToShowOnPreviousPage
                })
            }),
            button3 = new BootstrapPaginationButtonView({
                model: new Backbone.Model({
                    seq: 3,
                    title: "Next page",
                    content: "›",
                    index: this.startIndexOnNextPage,
                    count: this.numberOfElementsToShowOnNextPage
                })
            }),
            button4 = new BootstrapPaginationButtonView({
                model: new Backbone.Model({
                    seq: 4,
                    title: "Last page",
                    content: "»",
                    index: this.startIndexOnLastPage,
                    count: this.numberOfElementToShowOnLastPage
                })
            });

        _.each([button1, button2, button3, button4], function (button) {
            self.listenTo(button, "pagination", function (index, count) {
                self.trigger("pagination", index, count);
            });
        });

        this.$el.append("<ul>");
        this.$("ul").append(button1.render().el)
            .append(button2.render().el)
            .append(button3.render().el)
            .append(button4.render().el);

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
