# Audit.JS

A demo project/application for an _audit-friendly_ architecture.
The application is a JavaScript implementation.

Other noble goals this architecture will strive for are _maintainability_ and _scalability_.
Two properties often battling each other for attention and space ...

## Core design patterns
The core design patterns in this architecture are:

 1. Event Sourcing
 2. CQRS

Both these patterns originate from the Domain-Driven Design ([DDD] [10]) community.

#### Event Sourcing

Definitions are taken from Martin Fowler's [bliki][11]:

> _Capture all changes to an application state as a sequence of events._

#### CQRS

A rather ominously-looking abbreviation meaning _Command and Query Responsibility Segregation_.

It simply means that architecture should treat writes (commands) differently (segregated) than reads (queries).
The main motivation for this is that reads most often constitute the larger portion of the application traffic, so why not optimize for that.

## Design principles for Audit.JS

#### Event Sourcing stuff

 * _Application events are regarded as a first class construct_ in the application model, not just some infrastructural add-on piece.

 * _Application events are immutable_ - they are created and read, but never updated nor deleted.

 * When application state changes occur (creating, updating, or deleting something) event objects are created. These event objects contain the _state change only_ (a.k.a. the "diffs"/"deltas"). Meta data like object type, object ID, user, and timestamp are also included.

 * When created, application event objects are immediately persisted in the _event store_.
 
#### CQRS stuff

 * After an application event is created and persisted, the control is immediately given/response is sent back to the client.

 * When an application event is created and persisted, a message with the event content is sent to the _application store_. The application store is _read-only_ for all clients. (It should be regarded as a kind of a reporting database.)

 * All client _commands_ are sent to the _event store_ - all client _queries_ are sent to the _application store_.

#### The advantages

...are huge!

By querying the event store, we can look up the complete history of all application objects.

The entire application store are derived, and can re-created on demand by iterating through the event store.
The application store can be brought to all past points in time with great ease.

But the ability to read through the entire history of the application state not only opens for a full audit experience. 
It also opens the possibility to compare and merge application stores. 
It is not the application stores which are compared of course, it is the event stores. 
Complete or partial event stores can be iterated, compared, and merged, also relatively easely. Then the different application stores involved are updated.
Cloned data stores are often needed, e.g. for applications supporting offline usage.

And, not to forget, the application store is read-only (from the client's point of view), so some form of clever caching mechanism may be applied.


## The application

The Audit.JS demo application is a simple library app.
The initial setup is inspired by the example application in the book [_Developing Backbone.js Applications_] [15], by _Addy Osmani_.

#### Core technology components

On the client side:

 * [jQuery][20]
 * [Backbone.js][21]
 * [Backbone.Marionette][22]&nbsp;&nbsp;<sub><sup>(well, I plan to anyway ...)</sup></sub>
 * [Bootstrap][23]
 * [Socket.IO][24]&nbsp;&nbsp;<sub><sup>(well, I plan to anyway ...)</sup></sub>
 * [AmplifyJS][25]&nbsp;&nbsp;<sub><sup>(well, I plan to anyway ...)</sup></sub>

On the server side:

 * [MongoDB][30]
 * [Node.js][31]
 * [Socket.IO][23]&nbsp;&nbsp;<sub><sup>(well, I plan to anyway ...)</sup></sub>


#### Setup

 1. Install Node.js

 1. Install MongoDB

 1. Clone Audit.JS

    ```
    git clone https://github.com/eirikt/Audit.js.git
    ```

 1. Retrieve all dependencies via Node Package Manager (npm)

    ```
    cd ./Audit.JS/server
    npm install
    ```

 1. Start MongoDB deamon process (in the background), with local data directory

    ```
    mongod --dbpath data/db
    ```

 1. Start the Node Express app server configured in `server.js`

    ```
    node server.js
    ```

 1. Navigate to [http://localhost:4711](http://localhost:4711)


...

This markdown is written using the [Markdown Live Editor][50]

[10]: http://en.wikipedia.org/wiki/Domain-driven_design
[11]: http://martinfowler.com/eaaDev/EventSourcing.html
[15]: http://addyosmani.github.io/backbone-fundamentals/#exercise-2-book-library---your-first-restful-backbone.js-app

[20]: http://jquery.com
[21]: http://backbonejs.org
[22]: http://marionettejs.com
[23]: http://twitter.github.io/bootstrap
[24]: http://socket.io
[25]: http://amplifyjs.com
[30]: http://www.mongodb.org
[31]: http://nodejs.org

[50]: http://jrmoran.com/playground/markdown-live-editor
