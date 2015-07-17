/* global describe:false, it:false */
/* jshint -W030, -W069 */

var expect = require('chai').expect,
    Tag = require('../../../server/scripts/library-model.mongoose').Tag,
    Book = require('../../../server/scripts/library-model.mongoose').Book,
    createUuid = require('../../../server/scripts/mongoose.event-sourcing').createUuid;

describe('Library models', function () {
    'use strict';

    it('should create Book objects', function () {
        var tag1 = new Tag({ name: 'tag1' }),
            tag2 = new Tag({ name: 'tag2' }),
            book = new Book();

        expect(book).to.exist;

        book._id = createUuid();
        book.sequenceNumber = 1;
        book.title = 'title';
        book.author = 'author';
        book.tags = [tag1, tag2];

        expect(book._id).to.exist;
        expect(book.sequenceNumber).to.exist;
        expect(book.title).to.exist;
        expect(book.author).to.exist;
        expect(book.tags).to.exist;

        expect(book._id).to.be.an('object');
        expect(book.sequenceNumber).to.be.a('number');
        expect(book.title).to.be.a('string');
        expect(book.author).to.be.a('string');
        expect(book.tags).to.be.an('array');

        expect(book.sequenceNumber).to.be.equal(1);
        expect(book.title).to.be.equal('title');
        expect(book.author).to.be.equal('author');

        expect(book.tags.length).to.be.equal(2);
        expect(book.tags[0]).to.be.an('object');
        expect(book.tags[1]).to.be.an('object');
        expect(book.tags[0].name).to.be.a('string');
        expect(book.tags[1].name).to.be.a('string');
        expect(book.tags[0].name).to.be.equal('tag1');
        expect(book.tags[1].name).to.be.equal('tag2');
    });
});
