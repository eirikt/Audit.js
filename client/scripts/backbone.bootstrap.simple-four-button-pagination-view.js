/* global define: false */
define([
    "jquery", "underscore", "backbone",
    "backbone.bootstrap.pagination-button-view"
]

    , function ($, _, Backbone, BootstrapPaginationButtonView) {
        "use strict";

        /**
         * Simple Bootstrap-based centered pagination component with four static buttons, first, previous, next, and last.
         *
         * This view is expecting a model with:
         * <ul>
         *     <li/><code>count</code>: the total number of elements in the list
         *     <li/><code>pageCount</code>: the number of elements to show on each page
         *     <li/><code>currentIndex</code>: the index of the first book on the current page
         * </ul>
         * @see http://getbootstrap.com/components/#pagination
         */
        return Backbone.View.extend({
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

                this.$el.css({ "text-align": "center" }).append("<ul>");
                this.$("ul").addClass("pagination")
                    .append(button1.render().el)
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
    }
);
