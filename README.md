# AuditJS
A demo project/application for an _audit-friendly_ architecture.
The main technology component is JavaScript ... so, the JS postfix is approppriate, I guess :-)

Other noble goals for this architecture are _maintainability_ and _scalability_. Two properties often battling each other for attention and space ...

## Core design patterns
The core design patters this achitecture are:

 1. Event sourcing
 2. CQRS
 3. ...

#### Event sourcing

Definitions are taken from Martin Fowler's [bliki][10]:

> _Capture all changes to an application state as a sequence of events._

> We can query an application's state to find out the current state of the world, and this answers many questions. However there are times when we don't just want to see where we are, we also want to know how we got there.

> Event Sourcing ensures that all changes to application state are stored as a sequence of events. Not just can we query these events, we can also use the event log to reconstruct past states, and as a foundation to automatically adjust the state to cope with retroactive changes.

#### CQRS

A rather ominous-looking abbreviation that stands for _Command and Query Responsibility Segregation_.

It simply means that architecture should treat writes (commands) differently (segregated) than reads (queries).

The main motivation for this is that reads most often constitutes 80% or more of the application traffic. So why not optimize for that fact.

## Core design principles

Events should be regarded as a central construct in the application model, not just some infrastructural piece on-the-side.

_Events are immutable objects_ - they are written and read, but never updated nor deleted.

When a state change occurs (creating, updating, or deleting an object) it is treated as an event. 

The events contain the _state change only_ (a.k.a. the "diffs").
Meta data as _user_ and _timestamp_ are also added to the events.

Events are immediately stored. When it is stored, the control is given/response is sent back to the client. After the event is stored, a message containing the event is sent to the _view-oriented part of the repository_. The view-oriented part of the repository is modelled for user interaction. It can be regarded as a kind of a reporting database. It is _read-only_, making transactions obsolete. And making rather aggressive caching strategies simple to implement. 

#### Versioning possibilities

The ability to read through the entire history of the application state not only opens for a full audit experience. It also opens the possibility to compare application state. For instance, when comparing two different versions of the repository, as when dealing with a local and a central repo if the applications supports offline usage.



## The application

The Audit.JS demo application is a simple library app.

#### Core technology componenets

On the client side:

 1. [Backbone.js][20]
 2. [Twitter Bootstrap][21]

On the server side:

 1. [MongoDB][22]
 2. [Node.js][23]



...

This markdown is written using the excellent [Markdown Live Editor][50]

[10]: http://martinfowler.com/eaaDev/EventSourcing.html

[20]: http://backbonejs.org
[21]: http://twitter.github.io/bootstrap
[22]: http://www.mongodb.org
[23]: http://nodejs.org/

[50]: http://jrmoran.com/playground/markdown-live-editor
