/* global define: false */
define(["jquery", "underscore", "backbone", "moment"]

    , function ($, _, Backbone, Moment) {
        "use strict";

        var BookHistoryEventView = Backbone.View.extend({
            tagName: "tr",
            template: _.template('' +
                '<td><span class="tiny"><%= seq %></span></td>' +
                '<td>' +
                '  <span class="tiny">' +
                '    <% if (!currentState) { %>' +
                '    <a href="#" class="state" data-seq="<%= seq %>"><%= timestamp %></a>' +
                '    <% } else { %>' +
                '    <%= timestamp %>' +
                '    <% } %>' +
                '  </span>' +
                '</td>' +
                '<td><span class="tiny"><%= user %></span></td>' +
                '<td><span class="tiny"><%= method %></span></td>' +
                '<td><span class="tiny"><%- changes %></span></td>'
            ),
            _getRelativeTimeDescription: function (timestamp) {
                return new Moment(timestamp).fromNow();
            },
            render: function () {
                var clonedAttributes = this.model.toJSON();

                // Make a nice "how-many-hours-since" human readable timestamp
                clonedAttributes.timestamp = this._getRelativeTimeDescription(clonedAttributes.timestamp);

                // All attribute levels must be cloned before manipulation
                clonedAttributes.changes = _.clone(clonedAttributes.changes);

                // Only "create"/"update" events have "changes" content
                if (this.model.isCreate() || this.model.isUpdate()) {

                    // Remove the book sequence number "seq" (internal, not human readable)
                    delete clonedAttributes.changes.seq;

                    // Make the keyword property human readable (recursive flattening/"stringification")
                    if (clonedAttributes.changes.keywords) {
                        var keywords = _.clone(clonedAttributes.changes.keywords);
                        delete clonedAttributes.changes.keywords;
                        clonedAttributes.changes.keywords = _.map(keywords, function (keywordObj) {
                            return keywordObj.keyword;
                        });
                    }
                }
                // Default "changes" behaviour: Just stringify the changes properties to be human readable
                clonedAttributes.changes = JSON.stringify(clonedAttributes.changes);

                this.$el.html(this.template(clonedAttributes));
                return this;
            }
        });


        return Backbone.View.extend({
            template: _.template('' +
                '<p><br></p>' +
                '<small><strong>Book state change history</strong></small>' +
                '<table class="table table-condensed table-striped table-hover">' +
                '<thead>' +
                '  <tr>' +
                '    <th><span class="tiny">No</th>' +
                '    <th><span class="tiny">Time</span></th>' +
                '    <th><span class="tiny">User</span></th>' +
                '    <th><span class="tiny">Method</span></th>' +
                '    <th><span class="tiny">Changes</span></th>' +
                '  </tr>' +
                '</thead>' +
                '<tbody></tbody>' +
                '</table>'
            ),
            events: {
                "click .state": "replayToState"
            },
            render: function () {
                this.$el.html(this.template({}));
                this.model.history.each(function (stateChange) {
                    var bookView = new BookHistoryEventView({ model: stateChange });
                    this.$("tbody").prepend(bookView.render().el);
                }, this);
                return this;
            },
            reset: function () {
                this.model.history.fetch({ reset: true });
            },
            replayToState: function (event) {
                event.preventDefault();
                var elementDataSet = event.target.dataset;
                this.model.rewind(elementDataSet.seq);
            }
        });
    }
);
