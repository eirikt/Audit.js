# Audit.JS

A demo project/application for an _audit-friendly_ architecture.
The main technology component is JavaScript ... so, the JS postfix is appropriate, I guess :-)

Other noble goals this architecture will strive for are _maintainability_ and _scalability_. Two properties often battling each other for attention and space ...

## Core design patterns
The core design patters this architecture are:

 1. Event Sourcing
 2. CQRS

Both these patterns are originating from the Domain-Driven Design ([DDD] [10]) community.

#### Event Sourcing

Definitions are taken from Martin Fowler's [bliki][11]:

> _Capture all changes to an application state as a sequence of events._

> We can query an application's state to find out the current state of the world, and this answers many questions. However there are times when we don't just want to see where we are, we also want to know how we got there.

> Event Sourcing ensures that all changes to application state are stored as a sequence of events. Not just can we query these events, we can also use the event log to reconstruct past states, and as a foundation to automatically adjust the state to cope with retroactive changes.

#### CQRS

A rather ominously-looking abbreviation meaning _Command and Query Responsibility Segregation_.

It simply means that architecture should treat writes (commands) differently (segregated) than reads (queries). The main motivation for this is that reads most often constitute the larger portion of the application traffic, so why not optimize for that.

## Design principles for Audit.JS

#### Event Sourcing stuff

Events should be regarded as a central construct in the application model, not just some infrastructural add-on piece.

_Events are immutable objects_ - they are written and read, but never updated nor deleted. 

When a state change occurs (creating, updating, or deleting an object) it is treated as an event. These events contain the _state change only_ (a.k.a. the "diffs"/"deltas"). Meta data like object type, object ID, user, and timestamp are also included in these (state change) events.

Events are immediately stored (in the event store). When it is stored, the control is immediately given/response is sent back to the client. 
 
#### CQRS stuff

After the event is stored, a message containing the event is sent to the _view-oriented part of the repository_. This part of the repository is modelled for users browsing the application. It can be regarded as a kind of a reporting database. For application clients this database is only available as _read-only_.

How these state change events are forwarded to the view-oriented part of the repository is a rather important part of the detailed design and implementation. I guess several strategies will unfold when working with this little demo app ... The performance of the underlying hardware maybe will dictate some behaviour as well, hopefully in a scalable/adaptive manner.

#### _Your_ changes and _other user's_ changes

An important feature in user experience is that users immediately see and keep seeing their own changes in the application. This is achieved with a local _user cache_. All cached items in this cache overwrites its counterparts fetched from the central (view-oriented) repository. This local user cache automatically expires items after a fixed timespan - a setting coupled with the time spent updating the the central (view-oriented) repository with data from the state change events. 

There is a chance that multiple users updates the same objects without seeing other users changes, a kind of lost update. The possibility for this increases with the delay in the state change forwarding/dispatching.

#### To the rescue, full versioning

The ability to read through the entire history of the application state not only opens for a full audit experience. It also opens the possibility to compare application state. For instance, when comparing two different versions of the repository, as when dealing with data synchronization between a local and a central repo for applications supporting offline usage. Another important possibility is to detect conflicts associated with the lost update problem mentioned above. The users should be notified if such conflicts occurs, and maybe also some sort of conflict-resolve dialog might pop up.

## The implementation

The Audit.JS demo application is a simple library app.
The initial setup is inspired by the example application in the book [_Developing Backbone.js Applications_] [15], by _Addy Osmani_.

#### Core technology components

On the client side:

 1. [jQuery][20]
 2. [Backbone.js][21]
 3. [Backbone.Marionette][22]
 4. [Bootstrap][23]
 5. [Socket.IO][24]

On the server side:

 1. [MongoDB][30]
 2. [Node.js][31]
 3. [Socket.IO][23]


...

This markdown is written using the excellent [Markdown Live Editor][50]

[10]: http://en.wikipedia.org/wiki/Domain-driven_design
[11]: http://martinfowler.com/eaaDev/EventSourcing.html
[15]: http://addyosmani.github.io/backbone-fundamentals/#exercise-2-book-library---your-first-restful-backbone.js-app

[20]: http://jquery.com
[21]: http://backbonejs.org
[22]: http://marionettejs.com
[23]: http://twitter.github.io/bootstrap
[24]: http://socket.io
[30]: http://www.mongodb.org
[31]: http://nodejs.org

[50]: http://jrmoran.com/playground/markdown-live-editor/
