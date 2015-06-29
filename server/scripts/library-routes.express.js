/* jshint -W024 */

var eventSourcingService = require('./eventsourcing-service-api'),
    cqrsService = require('./cqrs-service-api'),
    libraryService = require('./library-service-api'),

    app = require('./express.config.js').appServer;


///////////////////////////////////////////////////////////////////////////////
// Main server configuration:
// The CQRS/Event Sourcing resources
///////////////////////////////////////////////////////////////////////////////

app.get('/cqrs/status', cqrsService.status);
app.post('/cqrs/toggle', cqrsService.toggle);

app.get('/events/:entityId', eventSourcingService.stateChanges);
app.post('/events/count', eventSourcingService.count);
app.post('/events/replay', eventSourcingService.replay);


///////////////////////////////////////////////////////////////////////////////
// Main server configuration:
// The Library domain resources
///////////////////////////////////////////////////////////////////////////////

app.post('/library/books/count', libraryService.countAllBooks);
app.post('/library/books/projection', libraryService.projectBooks);
app.put('/library/books/:entityId', libraryService.updateBook);
app.delete('/library/books/:entityId', libraryService.removeBook);

app.post('/library/books/generate', libraryService.generateBooks);
app.post('/library/books/clean', libraryService.removeAllBooksFromCache);

app.post('/library/loans/generate', libraryService.generateLoans);

// TODO: Choose resource id! Or support both!?
app.get('/library/loans/count/:entityId', libraryService.countLoansForBook);
app.get('/library/books/:entityId/loans/count', libraryService.countLoansForBook);

app.get('/library/loans/active/:entityId', libraryService.isBookOnLoan);
app.get('/library/books/:entityId/loans/active', libraryService.isBookOnLoan);

app.post('/library/visits/count', libraryService.countAllVisits);
app.post('/library/loans/count', libraryService.countAllLoans);
