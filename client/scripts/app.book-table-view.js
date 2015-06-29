/* global define:false */

define([
        'underscore', 'backbone', 'spin',
        'backbone.data-status', 'backbone.status-view', 'backbone.bootstrap.simple-four-button-pagination-view',
        'app'],

    function (_, Backbone, Spinner, DataStatus, DataStatusView, BootstrapSimpleFourButtonPaginationView, App) {
        'use strict';

        var spinJsOptions = {
            lines: 7 // The number of lines to draw
            , length: 2 // The length of each line
            , width: 2 // The line thickness
            , radius: 2 // The radius of the inner circle
            , scale: 1.25 // Scales overall size of the spinner
            , corners: 1 // Corner roundness (0..1)
            , color: '#ccc' // #rgb or #rrggbb or array of colors
            , opacity: 0 // Opacity of the lines
            , rotate: 0 // The rotation offset
            , direction: 1 // 1: clockwise, -1: counterclockwise
            , speed: 1 // Rounds per second
            , trail: 60 // Afterglow percentage
            , fps: 20 // Frames per second when using setTimeout() as a fallback for CSS
            , zIndex: 2e9 // The z-index (defaults to 2000000000)
            , className: 'spinner' // The CSS class to assign to the spinner
            , top: '10px' // Top position relative to parent
            , left: '35px' // Left position relative to parent
            , shadow: false // Whether to render a shadow
            , hwaccel: false // Whether to use hardware acceleration
            , position: 'relative' // Element positioning
        };

        var BookCountView = Backbone.View.extend({
            className: 'row',
            template: _.template('' +
                '<div class="col-sm-12">' +
                '  <span class="pull-right">' +
                '    <small><em>&nbsp;&nbsp;&nbsp;Number of books found in projection:&nbsp;<strong><%= args.bookCount %></strong></em></small>' +
                '  </span>' +
                '</div>',
                { variable: 'args' }
            ),
            render: function () {
                this.$el.html(this.template(this.model.toJSON()));
                return this;
            }
        });


        var BookInfoTableFilteringRowView = Backbone.View.extend({
            tagName: 'tr',
            template: _.template('' +
                '<td></td>' +
                '<td><small><input id="titleSubstring" type="text" class="form-control" placeholder="filter on title" value="<%= args.titleSubstring %>"/></small></td>>' +
                '<td><small><input id="authorSubstring" type="text" class="form-control" placeholder="filter on author" value="<%= args.authorSubstring %>"/></small></td>' +
                '<td><small><input id="tags" type="text" class="form-control" placeholder="filter on tags" disabled title="Not yet available"/></small></td>' +
                '<td></td>' +
                '<td></td>',
                { variable: 'args' }
            ),
            render: function () {
                this.$el.html(this.template(this.model.toJSON()));
                return this;
            }
        });


        var BookLoanCount = Backbone.Model.extend({
            defaults: {
                entityId: '',
                count: -1
            },
            initialize: function () {
                this.entityId = arguments[0].entityId;
            },
            url: function () {
                return '/library/books/' + this.entityId + '/loans/count';
            }
        });


        var BookLoanCountView = Backbone.View.extend({
            tagName: 'span',
            className: 'book-loan-count',
            template: _.template(
                '<span style="text-align:center;"><%= args.count %></span>',
                { variable: 'args' }
            ),
            initialize: function () {
                console.log('\'BookLoanCountView::initialize\'');
                this.listenTo(this.model, 'change', this.render);
            },
            render: function () {
                console.log('\'BookLoanCountView::render\'');

                if (this.model.get('count') >= 0) {
                    this.$el.html(this.template(this.model.toJSON()));
                    return this;
                }

                var spinner = new Spinner(spinJsOptions).spin();
                this.$el.empty().append(spinner.el);

                return this;
            }
        });


        var BookIsOnLoan = Backbone.Model.extend({
            defaults: {
                entityId: '',
                onLoan: false
            },
            initialize: function () {
                this.entityId = arguments[0].entityId;
            },
            url: function () {
                return '/library/books/' + this.entityId + '/loans/active';
            }
        });


        var BookIsOnLoanView = Backbone.View.extend({
            tagName: 'span',
            template: _.template(
                '<span style="text-align:center;"><%= args.isOnLoan %></span>',
                { variable: 'args' }
            ),
            initialize: function () {
                console.log('\'BookIsOnLoanView::initialize\'');
                this.listenTo(this.model, 'change', this.render);
            },
            _transformBool2VisualChecksIcons: function (model) {
                var checked = '<span class="icon-check" style="font-size:larger;"></span>',
                    notChecked = '',
                    chosen = model.get('isOnLoan') === true ? checked : notChecked;
                model.set('isOnLoan', chosen, { silent: true });
            },
            render: function () {
                console.log('\'BookIsOnLoanView::render\'');
                if (this.model.get('isOnLoan')) {
                    var clonedModel = this.model.clone();
                    this._transformBool2VisualChecksIcons(clonedModel);
                    this.$el.html(clonedModel.get('isOnLoan'));

                } else {
                    var spinner = new Spinner(spinJsOptions).spin();
                    this.$el.empty().append(spinner.el);
                }
                return this;
            }
        });


        var BookInfoTableRowView = Backbone.View.extend({
            tagName: 'tr',
            template: _.template('' +
                '<td><small><%= args.seq %></small></td>' +
                '<td><small><a href="#/library/books/<%= args._id %>"><%- args.title %></a></small></td>' +
                '<td><small><%- args.author %></small></td>' +
                '<td><% _.each(tags, function(tagObj) { %><span class="tag"><%= args.tagObj.tag %></span><% }); %></td>' +
                '<td style="text-align:center;"><small><span id="loanCount_<%= args._id %>"></span></small></td>' +
                '<td style="text-align:center;"><small><span id="isOnLoan_<%= args._id %>"></span></small></td>',
                { variable: 'args' }
            ),
            render: function () {
                //var clonedModel = this.model.clone();
                //this._transformBool2VisualChecksIcons(clonedModel);
                //this.$el.html(this.template(clonedModel.toJSON()));
                this.$el.html(this.template(this.model.toJSON()));


                var bookLoanCount = new BookLoanCount({ entityId: this.model.id });
                var bookLoanCountView = new BookLoanCountView({ model: bookLoanCount });

                var bookLoanCountJqueryElementId = '#loanCount_' + this.model.id;
                // TODO: ...
                //var bookLoanCountJqueryElementId = bookLoanCountView.getParentElementId(); // => '#loan_' + this.model.id;
                this.$(bookLoanCountJqueryElementId).append(bookLoanCountView.render().el);

                bookLoanCount.fetch();


                var bookIsOnLoan = new BookIsOnLoan({ entityId: this.model.id });
                var bookIsOnLoanView = new BookIsOnLoanView({ model: bookIsOnLoan });

                var bookIsOnLoanJqueryElementId = '#isOnLoan_' + this.model.id;
                this.$(bookIsOnLoanJqueryElementId).append(bookIsOnLoanView.render().el);

                bookIsOnLoan.fetch();


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
                '    <th style="text-align:center;"><small># Loans</small></th>' +
                '    <th style="text-align:center;"><small>On loan</small></th>' +
                '  </tr>' +
                '</thead>' +
                '<tbody></tbody>' +
                '</table>',
                { variable: 'args' }
            ),
            initialize: function () {
                //this.dataStatus = new DataStatus();
                //DataStatusView.prototype.className = null;
                //DataStatusView.prototype.style = "margin-left: 2rem; font-size: x-small; vertical-align: 10%;";
                //var dataStatusView = new DataStatusView({ model: this.dataStatus });
                //$("#bookListStatus").empty().append(dataStatusView.el);

                this.listenTo(this.collection, 'reset remove', this.render);
            },
            isVisible: function () {
                return this.$el.parent('div').hasClass('in');
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
                this.listenTo(paginator, 'pagination', function (index, count) {
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
                this.$('tbody').append(filterRow.render().el);
                return filterRow;
            },
            _renderBook: function (model) {
                var bookRow = new BookInfoTableRowView({ model: model });
                this.$('tbody').append(bookRow.render().el);
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

                this.$('#titleSubstring').off().bindWithDelay('keyup', function () {
                    var $el = $(this);
                    self.collection.filtering.titleSubstring = $el.val();
                    self.collection.pagination.currentIndex = 0; // 'reset' book table
                    self.collection.fetch().done(function () {
                        self.$('#titleSubstring').focus().val($el.val());
                    });
                }, App.KEYUP_TRIGGER_DELAY_IN_MILLIS);

                this.$('#authorSubstring').off().bindWithDelay('keyup', function () {
                    var $el = $(this);
                    self.collection.filtering.authorSubstring = $el.val();
                    self.collection.pagination.currentIndex = 0; // 'reset' book table
                    self.collection.fetch().done(function () {
                        self.$('#authorSubstring').focus().val($el.val());
                    });
                }, App.KEYUP_TRIGGER_DELAY_IN_MILLIS);

                //this.dataStatus.updateStatus(this.collection);
            },
            close: function () {
                this.$('tr').remove();
            }
        });
    }
)
;
