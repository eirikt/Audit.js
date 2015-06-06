define([
        "underscore", "backbone",
        "backbone.data-status", "backbone.status-view", "backbone.bootstrap.simple-four-button-pagination-view",
        "app"],

    function (_, Backbone, DataStatus, DataStatusView, BootstrapSimpleFourButtonPaginationView, App) {
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
                '<td><small><input id="tags" type="text" class="form-control" placeholder="filter on tags" disabled title="Not yet available"/></small></td>'
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
                '<td><% _.each(tags, function(tagObj) { %><span class="tag"><%= tagObj.tag %></span><% }); %></td>' +

                '<td><small><em><span style="color:lightgrey;">(todo)</span></em></small></td>' +
                '<td><small><em><span style="color:lightgrey;">(todo)</span></em></small></td>'
                //'<td><small><em><%= numberOfLoans %></em></small></td>' +
                //'<td><small><em><%= isOnLoan %></em></small></td>'
            ),
            transformBool2VisualChecksIcons: function (model) {
                var checked = '<span class="icon-check" style="font-size:larger;"></span>',
                    notChecked = '',
                    chosen = model.get('isOnLoan') === true ? checked : notChecked;
                model.set('isOnLoan', chosen, { silent: true });
            },
            render: function () {
                var clonedModel = this.model.clone();
                this.transformBool2VisualChecksIcons(clonedModel);
                this.$el.html(this.template(clonedModel.toJSON()));
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
                '    <th><small>Tags</small></th>' +
                '    <th><small># Loans</small></th>' +
                '    <th><small>On loan</small></th>' +
                '  </tr>' +
                '</thead>' +
                '<tbody></tbody>' +
                '</table>'
            ),
            initialize: function () {
                //this.dataStatus = new DataStatus();
                //DataStatusView.prototype.className = null;
                //DataStatusView.prototype.style = "margin-left: 2rem; font-size: x-small; vertical-align: 10%;";
                //var dataStatusView = new DataStatusView({ model: this.dataStatus });
                //$("#bookListStatus").empty().append(dataStatusView.el);

                this.listenTo(this.collection, "reset remove", this.render);
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
                        count: this.collection.hasFiltering() ? this.collection.filtering.totalCount : this.collection.totalBookCount,
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

                //this.dataStatus.updateStatus(this.collection);
            },
            close: function () {
                this.$("tr").remove();
            }
        });
    }
);
