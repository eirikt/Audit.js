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
            // Get rid of the top div as well ...
            template: _.template('' +
                '<div class="row">' +
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
                '</div>' +
                '</div>'
            ),
            events: {
                "click #generate": "generateRandomBooks",
                "click #removeAllBooks": "removeAllBooks"
            },
            initialize: function () {
                var generateBooksProgressbar = new Progressbar({ headerText: "Generating random books ..." });
                generateBooksProgressbar.listenTo(App.pushClient, "acquiring-sequencenumbers", function (totalCount, startTime) {
                    generateBooksProgressbar.reset();
                    generateBooksProgressbar.set("headerText", "Generating " + prettyprintInteger(totalCount) + " random books ...");
                });

                var bookSequenceNumbersProgressbar = new Progressbar({ headerText: "Acquiring book sequence numbers ..." });
                bookSequenceNumbersProgressbar.listenTo(App.pushClient, "acquiring-sequencenumbers", bookSequenceNumbersProgressbar.start);
                bookSequenceNumbersProgressbar.listenTo(App.pushClient, "sequencenumber-acquired", bookSequenceNumbersProgressbar.progress);
                bookSequenceNumbersProgressbar.listenTo(App.pushClient, "all-sequencenumbers-acquired", bookSequenceNumbersProgressbar.finish);

                var stateChangeEventsProgressbar = new Progressbar({ headerText: "Creating book state change event objects ... " +
                    "<span class='pull-right' style='margin-right:1rem;'><small><em>(event store)</em></small></span>"
                });
                stateChangeEventsProgressbar.listenTo(App.pushClient, "creating-statechangeevents", stateChangeEventsProgressbar.start);
                stateChangeEventsProgressbar.listenTo(App.pushClient, "statechangeevent-created", stateChangeEventsProgressbar.progress);
                stateChangeEventsProgressbar.listenTo(App.pushClient, "all-statechangeevents-created", stateChangeEventsProgressbar.finish);

                var booksProgressbar = new Progressbar({ headerText: "Creating book objects ...  " +
                    "<span class='pull-right' style='margin-right:1rem;'><small><em>(application store)</em></small></span>"
                });
                booksProgressbar.listenTo(App.pushClient, "generating-books", booksProgressbar.start);
                booksProgressbar.listenTo(App.pushClient, "book-generated", booksProgressbar.progress);
                booksProgressbar.listenTo(App.pushClient, "all-books-generated", booksProgressbar.finish);

                this.subView = new BootstrapModalMultipleProgressbarView({
                    model: generateBooksProgressbar,
                    collection: new ProgressbarCollection([bookSequenceNumbersProgressbar, stateChangeEventsProgressbar, booksProgressbar])
                });
                this.render();
            },
            render: function() {
                this.$el.html(this.template());
                return this;
            },
            generateRandomBooks: function () {
                var numberOfBooksToGenerate = this.$("#numberOfBooksToGenerate").val();
                if (numberOfBooksToGenerate) {
                    //new app.GenerateRandomBooks().save({ numberOfBooks: parseInt(numberOfBooksToGenerate, 10) });
                    var GenerateRandomBooks = Backbone.Model.extend({
                        url: "/library/books/generate"
                    });
                    new GenerateRandomBooks().save({ numberOfBooks: parseInt(numberOfBooksToGenerate, 10) });

                    this.subView.model.set("headerText", "Generating " + prettyprintInteger(numberOfBooksToGenerate) + "random books ...", { silent: true });

                } else {
                    numberOfBooksToGenerate = 0
                }
                console.log("generateRandomBooks: " + numberOfBooksToGenerate + " books");
            },
            removeAllBooks: function () {
                //new app.RemoveAllBooks().save();
                var RemoveAllBooks = Backbone.Model.extend({
                    url: "/library/books/clean"
                });
                new RemoveAllBooks().save();
            }
        })
    }
);
