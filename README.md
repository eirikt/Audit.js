# Audit.JS

A prototype project for an _audit-friendly_ application architecture.
This prototype is a JavaScript implementation.


## Core design patterns

The core design patterns in this architecture are:

 1. [Event Sourcing][11]
 2. [CQRS][12]

Both these patterns originate from the Domain-Driven Design ([DDD][10]) community.

#### Event Sourcing

What Event Sourcing is all about may simply be stated as:

> _Capture all changes to an application state as a sequence of events._

> -- <cite>Martin Fowler</cite>

#### CQRS

A rather ominously-looking abbreviation meaning _Command and Query Responsibility Segregation_.

It simply means that an architecture should handle (responsibility) reads (queries) differently (segregated) than writes (commands).
The main motivation for this is the fact that read and write operations require very different "attention" from the system architecture. 
Also, reads most often constitute the larger portion of the application traffic, so why not optimize for that.


## Design principles for Audit.JS

#### Event Sourcing stuff

 * _Application events are regarded as first class constructs_ in the application model, not just some "infrastructural" add-on piece.

 * _Application events are immutable and forever_ - they are created and read, but never updated nor deleted.

 * When application state changes occur (creating, updating, or deleting something) event objects are created. These event objects contain the _state change only_ (a.k.a. the "diffs"/"deltas"). Meta data like object type, object ID, user, and timestamp are also included.

 * When created, application event objects are immediately persisted in the _event store_.
 
#### CQRS stuff

 * After an application event is created and persisted, the control is immediately given/response is sent back to the client.

 * When an application event is created and persisted, a message with the event content is sent to the _application store_. The application store is _read-only_ for all clients. (It should be regarded as a kind of a reporting database, possibly with multiple representations taylored for each UI view.)

 * All client _commands_ are sent to the _event store_ - all client _queries_ are sent to the _application store_.

#### The advantages

...are huge!

By querying the event store, we can look up the complete history of all application objects.

The entire application store are derived, and can be re-created on demand by iterating through the events in the event store.
The application store can be brought to all past points in time with great ease.

But the ability to read through the entire history of the application state not only opens for a full audit experience. 
It also opens the possibility to compare and merge different application stores.
It is not the application stores which are compared of course, it is the event stores.
Complete or partial event stores can be iterated, compared, and merged - rather easily.
The different application stores involved may then be updated accordingly.
Cloned data stores are often needed, e.g. for applications supporting offline usage.

And, not to forget, the application store is read-only (from the client's point of view that is), so some form of clever caching mechanism should be applied. 
It is straightforward to pin-point necessary cache invalidation in the application store as we have full control over all state changes.

The use of [HTTP server push][13] techniques (e.g. provided by [Socket.IO][24]) further brings new possibilities into this application architecture. 
E.g. if there are some kind of problem with the application store update, a server-push message should be sent to the originating client. 
Likewise, when the update of the application store completes successfully, a broadcast message containing the new state should be sent to all participating clients. 
HTTP server push also should be ideal for the "chatty" conversations involved when merging event stores.


## The application

The Audit.JS prototype application is a simple library app.
The initial setup is inspired by the example application in the book [_Developing Backbone.js Applications_][16], by _Addy Osmani_.

#### Core libs

On the client side:

 * [jQuery][20]
 * [Backbone.js][21]
 * [Socket.IO][24]
 * [Moment.js][26]

On the server side:

 * [MongoDB][30]
 * [Mongoose][31]
 * [Node.js][35]
 * [Socket.IO][23]

#### Setup

 1. Install [MongoDB][30] <sub><sup>(make sure it's running on the default port 27017)</sup></sub>

 1. Install [Node.js][35]

 1. Clone Audit.JS

    ```
    git clone https://github.com/eirikt/Audit.js.git
    ```

 1. Retrieve all dependencies via Node Package Manager (npm)

    ```
    cd ./Audit.JS/server
    npm install
    ```

 1. Start MongoDB deamon process (with a local data directory)

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
[12]: http://martinfowler.com/bliki/CQRS.html
[13]: http://en.wikipedia.org/wiki/Push_technology

[16]: http://addyosmani.github.io/backbone-fundamentals/#exercise-2-book-library---your-first-restful-backbone.js-app

[20]: http://jquery.com
[21]: http://backbonejs.org
[22]: http://marionettejs.com
[23]: http://requirejs.org
[24]: http://socket.io
[25]: http://amplifyjs.com
[26]: http://momentjs.com
[27]: http://twitter.github.io/bootstrap

[30]: http://www.mongodb.org
[31]: http://mongoosejs.com

[35]: http://nodejs.org

[50]: http://jrmoran.com/playground/markdown-live-editor


...

## MIT Licence

Copyright © 2013 Eirik Torske All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
