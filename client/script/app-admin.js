var app = app || {};

///////////////////////////////////////////////////////////////////////////////
// Models
///////////////////////////////////////////////////////////////////////////////

app.CqrsCheck = Backbone.Model.extend({
    url: "/events/cqrs/status"
});

app.CqrsToggle = Backbone.Model.extend({
    url: "/events/cqrs/toggle"
});

app.EventStoreCount = Backbone.Model.extend({
    /*defaults: { totalCount: 0, createCount: 0, updateCount: 0, deleteCount: 0 },*/
    url: "/events/count"
});

app.EventStoreReplay = Backbone.Model.extend({
    url: "/events/replay"
});

app.GenerateRandomBooks = Backbone.Model.extend({
    url: "/library/books/generate"
});

app.RemoveAllBooks = Backbone.Model.extend({
    url: "/library/books/clean"
});


///////////////////////////////////////////////////////////////////////////////
// Views
///////////////////////////////////////////////////////////////////////////////

app.StateChangeAdminView = Backbone.View.extend({
    templateSelector: "#stateChangeAdminTemplate",
    template: null,
    events: {
        "click #toggleCqrs": "toggleCqrs",
        "click #replay": "replayChangeLog"
    },
    cqrsActive: null,

    initialize: function () {
        this.template = _.template($(this.templateSelector).html());

        var replayProgressbar = new Progressbar({
            headerText: "Replaying all state change events into application store ..."
        });
        replayProgressbar.listenTo(app.pushClient, "replaying-events", replayProgressbar.start);
        replayProgressbar.listenTo(app.pushClient, "event-replayed", replayProgressbar.progress);
        replayProgressbar.listenTo(app.pushClient, "all-events-replayed", replayProgressbar.finish);
        new BootstrapModalProgressbarView({ model: replayProgressbar });

        this.listenTo(app.pushClient, "cqrs", this.renderButtons);
        this.listenTo(this.model, "change", this.render);
        this.model.fetch();
    },
    render: function () {
        var model = this.model.clone().toJSON();
        model.totalCount = prettyprintInteger(model.totalCount);
        model.createCount = prettyprintInteger(model.createCount);
        model.updateCount = prettyprintInteger(model.updateCount);
        model.deleteCount = prettyprintInteger(model.deleteCount);
        this.$el.html(this.template(model));
        this.checkCqrs();
    },
    renderButtons: function (usingCqrs) {
        if (usingCqrs) {
            this.cqrsActive = true;
            this.$("#toggleCqrs").removeClass("btn-warning").addClass("btn-success").empty().append("CQRS ON");
            this.$("#replay").removeClass("disabled").attr("title", "");
        } else {
            this.cqrsActive = false;
            this.$("#toggleCqrs").addClass("btn-warning").removeClass("btn-success").empty().append("CQRS OFF");
            this.$("#replay").addClass("disabled").attr("title", "N/A as CQRS is disabled");
        }
    },
    checkCqrs: function () {
        new app.CqrsCheck().fetch().done(_.bind(this.renderButtons, this));
    },
    toggleCqrs: function () {
        new app.CqrsToggle().save();
    },
    replayChangeLog: function (event) {
        if (this.cqrsActive) {
            new app.EventStoreReplay().save();

        } else {
            event.preventDefault();
        }
    }
});


app.LibraryAdminView = Backbone.View.extend({
    templateSelector: "#libraryAdminTemplate",
    template: null,
    events: {
        "click #generate": "generateRandomBooks",
        "click #removeAllBooks": "removeAllBooks"
    },
    initialize: function () {
        var generateBooksProgressbar = new Progressbar({ headerText: "Generating random books ..." });

        var bookSequenceNumbersProgressbar = new Progressbar({ headerText: "Acquiring book sequence numbers ..." });
        bookSequenceNumbersProgressbar.listenTo(app.pushClient, "acquiring-sequencenumbers", bookSequenceNumbersProgressbar.start);
        bookSequenceNumbersProgressbar.listenTo(app.pushClient, "sequencenumber-acquired", bookSequenceNumbersProgressbar.progress);
        //bookSequenceNumbersProgressbar.listenTo(app.pushClient, "all-sequencenumbers-acquired", bookSequenceNumbersProgressbar.finish);

        var stateChangeEventsProgressbar = new Progressbar({ headerText: "Creating state change event objects ... <em>(event store)</em>" });
        stateChangeEventsProgressbar.listenTo(app.pushClient, "creating-statechangeevents", stateChangeEventsProgressbar.start);
        stateChangeEventsProgressbar.listenTo(app.pushClient, "statechangeevent-created", stateChangeEventsProgressbar.progress);
        //stateChangeEventsProgressbar.listenTo(app.pushClient, "all-statechangeevents-created", stateChangeEventsProgressbar.finish);

        var booksProgressbar = new Progressbar({ headerText: "Creating book objects ... <em>(application store)</em>" });
        booksProgressbar.listenTo(app.pushClient, "generating-books", booksProgressbar.start);
        booksProgressbar.listenTo(app.pushClient, "book-generated", booksProgressbar.progress);
        //booksProgressbar.listenTo(app.pushClient, "all-books-generated", booksProgressbar.finish);

        new BootstrapModalMultipleProgressbarView({
            model: generateBooksProgressbar,
            collection: new ProgressbarCollection([bookSequenceNumbersProgressbar, stateChangeEventsProgressbar, booksProgressbar])
        });

        this.render();
    },
    render: function () {
        this.$el.html($(this.templateSelector).html());
    },
    generateRandomBooks: function () {
        var numberOfBooksToGenerate = this.$("#numberOfBooksToGenerate").val();
        if (numberOfBooksToGenerate) {
            new app.GenerateRandomBooks().save({ numberOfBooks: parseInt(numberOfBooksToGenerate, 10) });
        } else {
            numberOfBooksToGenerate = 0
        }
        console.log("generateRandomBooks: " + numberOfBooksToGenerate + " books");
    },
    removeAllBooks: function () {
        new app.RemoveAllBooks().save();
    }
});
