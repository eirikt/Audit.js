/* global define:false */
define(["jquery", "underscore", "backbone", "app", "app.Book"],

    function ($, _, Backbone, App, Book) {
        "use strict";

        return Backbone.Collection.extend({
            url: "/library/books/projection",
            model: Book,
            totalBookCount: 0,
            defaultPagination: {
                orderBy: null,                            // Not yet supported ...
                count: App.LIBRARY_PAGINATION_SIZE,       // Overall number of books for each page / Pagination flag
                currentIndex: 0,                          // Overall book index
                currentCount: App.LIBRARY_PAGINATION_SIZE // Number of books on current page
            },
            defaultFiltering: {
                titleSubstring: null,
                authorSubstring: null,
                keywords: null,
                count: 0,
                totalCount: 0
            },
            initialize: function (options) {
                this.pagination = this.defaultPagination;
                this.pagination.count = App.LIBRARY_PAGINATION_SIZE;        // Overall number of books for each page / Pagination flag
                this.pagination.currentCount = App.LIBRARY_PAGINATION_SIZE; // Overall number of books for each page / Pagination flag
                if (!options || options && (!options.pagination || options.pagination === false)) {
                    this.pagination = false;
                }

                this.filtering = this.defaultFiltering;
                if (!options || options && (!options.filtering || options.filtering === false)) {
                    this.filtering = false;
                }
            },
            _fetchByPOST: function () {
                return Backbone.Collection.prototype.fetch.call(this, {
                    reset: true,
                    type: "POST",
                    url: this.url,
                    data: {
                        count: this.pagination.count,
                        index: this.pagination.currentIndex,
                        titleSubstring: this.filtering.titleSubstring,
                        authorSubstring: this.filtering.authorSubstring
                    }
                });
            },
            fetch: function () {
                return this._fetchByPOST();
            },
            parse: function (response) {
                this.totalBookCount = response.totalCount;
                this.filtering.totalCount = response.count;
                return response.books;
            },
            // Client-side sorting of book collection
            comparator: function (book) {
                return book.get("seq"); // Ascending sequence number (auto-generated)
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
    }
);
