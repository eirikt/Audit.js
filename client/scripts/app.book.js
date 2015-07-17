/* global define: false */
define(["underscore", "backbone", "backbone.audit.history"],

    function (_, Backbone, BackboneAuditHistory) {
        "use strict";

        var Book = Backbone.Model.extend({
            idAttribute: "_id",
            urlRoot: "/library/books",
            defaults: {
                sequenceNumber: null,
                title: null,
                author: null,
                //releaseDate: null,
                //coverImage: 'image/placeholder.png',
                tags: null
            }
        });

        // Make the book state-change aware
        _.extend(Book.prototype, BackboneAuditHistory);

        return Book;
    }
);
