/* global define: false, prettyprintInteger: false */
define([
    "underscore", "backbone",
    "app", "backbone.progressbar", "backbone.bootstrap.multi-progressbar-view"
]
    , function (_, Backbone, App, Progressbar, BootstrapModalMultipleProgressbarView) {
        "use strict";

        var ProgressbarCollection = Backbone.Collection.extend({
            model: Progressbar
        });

        return Backbone.View.extend({
            tagName: "div",
            className: "row",
            template: _.template('' +
                '<div class="col-xs-5">' +
                '  <div class="input-group">' +
                '    <input id="numberOfBooksToGenerate" type="text" class="form-control" placeholder="how many?" maxlength="6" style="text-align: right"/>' +
                '    <span class="input-group-btn">' +
                '      <button id="generate" class="btn btn-success">Generate books</button>' +
                '    </span>' +
                '  </div>' +
                '</div>' +
                '<div class="col-xs-7">' +
                '  <span>' +
                '    <button id="removeAllBooks" class="btn btn-danger pull-right">Clean books</button>' +
                '  </span>' +
                '</div>'
            ),
            events: {
                "click #generate": "generateRandomBooks",
                "click #removeAllBooks": "removeAllBooks"
            },
            initialize: function () {
                var generateBooksProgressbar = new Progressbar({ headerText: "Generating random books ..." });
                generateBooksProgressbar.listenTo(App.pushClient, "creating-statechangeevents", function (totalCount/*, startTime*/) {
                    generateBooksProgressbar.reset();
                    generateBooksProgressbar.set("headerText", "Generating " + prettyprintInteger(totalCount) + " random books ...");
                });

                var stateChangeEventsProgressbar = new Progressbar({ headerText: "Creating book state change event objects ... " +
                    "<span class='pull-right' style='margin-right:1rem;'><small><em>event store</em></small></span>"
                });
                stateChangeEventsProgressbar.listenTo(App.pushClient, "creating-statechangeevents", stateChangeEventsProgressbar.start);
                stateChangeEventsProgressbar.listenTo(App.pushClient, "statechangeevent-created", stateChangeEventsProgressbar.progress);
                stateChangeEventsProgressbar.listenTo(App.pushClient, "all-statechangeevents-created", stateChangeEventsProgressbar.finish);

                this.subView = new BootstrapModalMultipleProgressbarView({
                    model: generateBooksProgressbar,
                    collection: new ProgressbarCollection([stateChangeEventsProgressbar])
                });
                this.render();
            },
            render: function () {
                this.$el.html(this.template());
                return this;
            },
            generateRandomBooks: function () {
                var numberOfBooksToGenerate = this.$("#numberOfBooksToGenerate").val();
                if (numberOfBooksToGenerate) {
                    var GenerateRandomBooks = Backbone.Model.extend({
                        url: "/library/books/generate"
                    });
                    new GenerateRandomBooks().save({ numberOfBooks: parseInt(numberOfBooksToGenerate, 10) });

                    this.subView.model.set("headerText", "Generating " + prettyprintInteger(numberOfBooksToGenerate) + "random books ...", { silent: true });

                } else {
                    numberOfBooksToGenerate = 0;
                }
                console.log("generateRandomBooks: " + numberOfBooksToGenerate + " books");
            },
            removeAllBooks: function () {
                var RemoveAllBooks = Backbone.Model.extend({
                    url: "/library/books/clean"
                });
                new RemoveAllBooks().save();
            }
        });
    }
);
