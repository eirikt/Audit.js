/* global define: false */
define(["jquery", "underscore", "backbone"]

    , function ($, _, Backbone) {
        "use strict";

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
         * @see http://getbootstrap.com/components/#pagination
         */
        return Backbone.View.extend({
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
                        parseInt(event.target.dataset.count, 10)
                    );
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
    }
);
