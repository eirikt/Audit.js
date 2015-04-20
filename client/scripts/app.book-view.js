/* global define: false, disableFormInputFields: false */
define(["jquery", "underscore", "backbone"],

    function ($, _, Backbone) {
        "use strict";

        return Backbone.View.extend({
            template: _.template('' +
                '<form id="editBook" action="#">' +
                '<fieldset>' +
                '  <div class="row">' +
                '    <div class="pull-right" style="margin-bottom: 1.5rem;">' +
                '      <button id="updateBook" class="btn btn-primary">Update</button>' +
                '      <button id="deleteBook" class="btn btn-danger">Delete</button>' +
                '    </div>' +
                '  </div>' +
                '  <div class="row">' +
                '    <div class="col-sm-2">' +
                '      <label for="seq">No</label>' +
                '      <input id="seq" type="text" class="form-control" value="<%= seq %>" disabled/>' +
                '    </div>' +
                '    <div class="col-sm-5">' +
                '      <label for="title">Title</label>' +
                '      <input id="title" type="text" class="form-control" value="<%- title %>"/>' +
                '    </div>' +
                '    <div class="col-sm-5">' +
                '      <label for="author">Author</label>' +
                '      <input id="author" type="text" class="form-control" value="<%- author %>"/>' +
                '    </div>' +
                '  </div>' +
                '  <div class="row" style="margin-top:3rem;">' +
                '    <div class="col-sm-12">' +
                '      <label>Tags&nbsp;</label>' +
                '      <% _.each(keywords, function(keywordobject) { %><span class="label label-info"><%= keywordobject.keyword %></span>&nbsp;<% }); %>' +
                '    </div>' +
                '  </div>' +
                '</fieldset>' +
                '</form>'
            ),
            events: {
                "click #updateBook": "_updateBook",
                "click #deleteBook": "_deleteBook"
            },
            render: function () {
                this.$el.html(this.template(this.model.toJSON()));
                return this;
            },
            reset: function () {
                disableFormInputFields(this.$("#editBook"));
                this.$("button").attr("disabled", "disabled");
            },
            _isEditableField: function (fieldId) {
                return !_.isEmpty(fieldId) && fieldId !== "seq";
            },
            _isFieldEligibleForEditing: function ($el) {
                return this._isEditableField($el.id) && !_($el.value).isEmpty();
            },
            _getFormInputFieldsAsObjectProperties: function (filterFunc) {
                var isFieldEligibleForEditing = filterFunc || function () {
                        return true;
                    };
                return _.chain(this.$("div").children("input"))
                    .map(function ($inputEl) {
                        return isFieldEligibleForEditing($inputEl) ? [$inputEl.id, $inputEl.value] : null;
                    })
                    .compact() // Remove nulls
                    .object()  // Arrays to object properties
                    .value();
            },
            _updateBook: function (event) {
                event.preventDefault();
                var editableAttributes = this._getFormInputFieldsAsObjectProperties(_.bind(this._isFieldEligibleForEditing, this));
                this.model.update(editableAttributes);
            },
            _deleteBook: function (event) {
                event.preventDefault();
                this.model.remove();
            }
        });
    }
);
