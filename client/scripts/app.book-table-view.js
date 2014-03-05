define(["underscore", "backbone", "app", "backbone.bootstrap.simple-four-button-pagination-view"]

    , function (_, Backbone, App, BootstrapSimpleFourButtonPaginationView) {
        "use strict";

        var BookCountView = Backbone.View.extend({
            className: "row",
            template: _.template('' +
                '<div class="col-sm-12">' +
                '  <span class="pull-right">' +
                '    <small><em>&nbsp;&nbsp;&nbsp;Number of books found in projection:&nbsp;<strong><%= bookCount %></strong></em></small>' +
                '  </span>' +
                '</div>'
            ),
            render: function () {
                this.$el.html(this.template(this.model.toJSON()));
                return this;
            }
        });


        var BookInfoTableFilteringRowView = Backbone.View.extend({
            tagName: "tr",
            template: _.template('' +
                '<td></td>' +
                '<td><small><input id="titleSubstring" type="text" class="form-control" placeholder="filter on title" value="<%= titleSubstring %>"/></small></td>>' +
                '<td><small><input id="authorSubstring" type="text" class="form-control" placeholder="filter on author" value="<%= authorSubstring %>"/></small></td>' +
                '<td><small><input id="keywords" type="text" class="form-control" placeholder="filter on keyword" disabled title="Not yet available"/></small></td>'
            ),
            render: function () {
                this.$el.html(this.template(this.model.toJSON()));
                return this;
            }
        });


        var BookInfoTableRowView = Backbone.View.extend({
            tagName: "tr",
            template: _.template('' +
                '<td><small><%= seq %></small></td>' +
                '<td><small><a href="#/library/books/<%= _id %>"><%- title %></a></small></td>' +
                '<td><small><%- author %></small></td>' +
                '<td><small><% _.each(keywords, function(keyobj) { %><%= keyobj.keyword %>&nbsp;<% }); %></small></td>'
            ),
            render: function () {
                this.$el.html(this.template(this.model.toJSON()));
                return this;
            }
        });


        return Backbone.View.extend({
            template: _.template('' +
                '<table class="table table-condensed table-striped table-hover">' +
                '<thead>' +
                '  <tr>' +
                '    <th><small>No</small></th>' +
                '    <th><small>Title</small></th>' +
                '    <th><small>Author</small></th>' +
                '    <th><small>Keywords</small></th>' +
                '  </tr>' +
                '</thead>' +
                '<tbody></tbody>' +
                '</table>'
            ),
            initialize: function () {
                //this.template = _.template($(this.templateSelector).html());
                this.listenTo(this.collection, "reset", this.render);
            },
            isVisible: function () {
                return this.$el.parent("div").hasClass("in");
            },
            _renderBookCounter: function () {
                var counter = new BookCountView({
                    model: new Backbone.Model({
                        bookCount: this.collection.filtering.totalCount
                    })
                });
                this.$el.prepend(counter.render().el);
                return counter;
            },
            _renderPagination: function () {
                var paginator = new BootstrapSimpleFourButtonPaginationView({
                    model: new Backbone.Model({
                        count: this.collection.filtering.totalCount,
                        currentIndex: this.collection.pagination.currentIndex,
                        pageCount: this.collection.pagination.count
                    })
                });
                this.$el.prepend(paginator.render().el);

                var self = this;
                this.listenTo(paginator, "pagination", function (index, count) {
                    self.collection.pagination.currentIndex = index;
                    self.collection.pagination.currentCount = count;
                    self.collection.fetch();
                });
                return paginator;
            },
            _renderFiltering: function () {
                var filterRow = new BookInfoTableFilteringRowView({
                    model: new Backbone.Model(this.collection.filtering)
                });
                this.$("tbody").append(filterRow.render().el);
                return filterRow;
            },
            _renderBook: function (model) {
                var bookRow = new BookInfoTableRowView({ model: model });
                this.$("tbody").append(bookRow.render().el);
            },
            render: function () {
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
                }, App.KEYUP_TRIGGER_DELAY_IN_MILLIS);

                this.$("#authorSubstring").off().bindWithDelay("keyup", function () {
                    var $el = $(this);
                    self.collection.filtering.authorSubstring = $el.val();
                    self.collection.pagination.currentIndex = 0; // "reset" book table
                    self.collection.fetch().done(function () {
                        self.$("#authorSubstring").focus().val($el.val());
                    });
                }, App.KEYUP_TRIGGER_DELAY_IN_MILLIS);
            },
            close: function () {
                this.$("tr").remove();
            }
        });
    }
);
