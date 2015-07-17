var mongoose = require('mongoose'),
    utils = require("./utils"),
    curry = require("./fun").curry,


///////////////////////////////////////////////////////////////////////////////
// Subject/Verb/Object (Context/Action/Target (CAT)) base entity models
//
// See:
// https://en.wikipedia.org/wiki/Subject_(grammar)
// https://en.wikipedia.org/wiki/Verb
// https://en.wikipedia.org/wiki/Object_(grammar)
// http://en.wikipedia.org/wiki/Subject%E2%80%93verb%E2%80%93object
//
// TODO: To be extracted out into another standalone project
//
///////////////////////////////////////////////////////////////////////////////

    slice = Array.prototype.slice,
    apply = Array.prototype.apply,
    push = Array.prototype.push,

// TODO: Rename to 'extend'/'mixin', add to Array prototype, and include in CAT library
    cloneAndExtendArray = function (arrayToCloneAndExtend, arrayOfNewElements) {
        'use strict';
        var clonedAndExtendedArray = slice.call(arrayToCloneAndExtend, 0);
        push.apply(clonedAndExtendedArray, arrayOfNewElements);
        return clonedAndExtendedArray;
    },

    /**
     * Context base properties.
     * If these properties are applicable for the entity, they must be present in the event store (master data).
     *
     * The <em>subject</em> in a subject-verb-object structure.
     * Contexts are <em>completely generic models</em> on their own; resources on a specific location at a point in time.
     * Stuff like sourcing (mobilization), resource approvals, and description of objectives (standards and documentation) are most likely <em>application-specific</em> sub models.
     *
     * sequenceNumber : Regular sequence number (optional)
     * originator     : The parent context which caused this context to be created in the first place (optional)
     * children       : All child contexts in a hierarchical context structure (optional) (removed, replaced by 'oneToManyRelationshipModelDescriptor')
     * fromDate       : The starting date or timestamp (mandatory)
     * toDate         : The ending date or timestamp (mandatory)
     * locations      : The geographical whereabouts (mandatory)
     * resources      : References to all involved resources, both personnel and equipment (mandatory)
     */
    contextModelDescriptor = ['sequenceNumber', 'originator', 'fromDate', 'toDate', 'location', 'resources'],

    /**
     * Action base properties.
     * If these properties are applicable for the entity, they MUST be present in the event store (master data).
     * All properties (except 'sequenceNumber') may be either a reference or an embedded (copied) object.
     *
     * The <em>verb</em> in a subject-verb-object structure.
     *
     * sequenceNumber : Regular sequence number (optional)
     * originator     : The parent action which caused this action to be created in the first place (optional)
     * context        : The context of this action (mandatory)
     * target         : The target of this action (mandatory)
     * children       : All child actions in a hierarchical action structure (optional) (removed, replaced by 'oneToManyRelationshipModelDescriptor')
     * date           : The date or timestamp of this action (mandatory)
     */
    actionModelDescriptor = ['sequenceNumber', 'originator', 'context', 'target', 'date'],

    /**
     * Target (object) base properties.
     * If these properties are applicable for the entity, they must be present in the event store (master data).
     * All properties (except 'sequenceNumber') may be either a reference or an embedded (copied) object.
     *
     * The <em>object</em> in a subject-verb-object structure.
     *
     * sequenceNumber : Regular sequence number (optional)
     * children       : All child targets in a hierarchical target structure (optional) (removed, replaced by 'oneToManyRelationshipModelDescriptor')
     */
    targetModelDescriptor = ['sequenceNumber'],

    /**
     * One-to-many relationship ('association'/'aggregation'?) between parent and children.
     *
     * Seen as a tree structure, these objects will be edges (branches) between two nodes.
     * The nodes will mostly be target entities, but also contexts and actions may be structured as trees, I guess.
     * Entities may form multiple trees (may be called 'tree types'), which superimposed, forms a graph of entities.
     *
     * parent   : The parent ('predecessor'?) (optional, null if root node)
     * children : The children ('successors'?) (optional, null if leaf node)
     */
    oneToManyRelationshipModelDescriptor = ['parent', 'children'],


///////////////////////////////////////////////////////////////////////////////
// Library models
///////////////////////////////////////////////////////////////////////////////

// TODO: "Core models" - all elements, if present and applicable, are mandatory and must be present in event store
//tagCoreModelDescriptor = ['tag'],
//bookCoreModelDescriptor = ['seq', 'title', 'author', 'tags'],
//visitCoreModelDescriptor = ['seq', 'user', 'date'],
//loanCoreModelDescriptor = ['seq', 'book', 'visit', 'returnDate'],
    tagCoreModelDescriptor = ['name'], // A value object ...
    bookCoreModelDescriptor = cloneAndExtendArray(targetModelDescriptor, ['title', 'author', 'tags']),
    libraryVisitCoreModelDescriptor = cloneAndExtendArray(contextModelDescriptor, ['user', 'loanPeriodInDays']),
    bookLoanCoreModelDescriptor = cloneAndExtendArray(actionModelDescriptor, ['returnDate']),
    libraryCoreModelDescriptor = cloneAndExtendArray(targetModelDescriptor, ['name', 'address', 'openingHours']), // Example model only ...
    booksInLibraryCoreModelDescriptor = cloneAndExtendArray(oneToManyRelationshipModelDescriptor, ['bookReference', 'floor', 'shelf']), // Example model only ...

    _ImmutableTag = exports.ImmutableTag = curry(utils.ImmutableObject, tagCoreModelDescriptor),
    _ImmutableBook = exports.ImmutableBook = curry(utils.ImmutableObject, bookCoreModelDescriptor),
    _ImmutableVisit = exports.ImmutableVisit = curry(utils.ImmutableObject, libraryVisitCoreModelDescriptor),
    _ImmutableLoan = exports.ImmutableLoan = curry(utils.ImmutableObject, bookLoanCoreModelDescriptor),
    _ImmutableLibrary = exports.ImmutableLibrary = curry(utils.ImmutableObject, libraryCoreModelDescriptor), // Example model only ...
    _ImmutableLibraryBooks = exports.ImmutableLibraryBooks = curry(utils.ImmutableObject, booksInLibraryCoreModelDescriptor); // Example model only ...
