/* global describe:false, it:false */
/* jshint -W024, -W030, -W126, -W116 */

var expect = require('chai').expect,
    utils = require('../../../server/scripts/utils');

describe('Test "isMissing" factory function', function () {
    'use strict';

    it('should treat most falsey values as "missing"', function () {
        expect(utils.isMissing()()).to.be.true;
        expect(utils.isMissing(null)()).to.be.true;
        expect(utils.isMissing(false)()).to.be.true;

        // NB! But not:
        expect(utils.isMissing(0)()).to.be.false;
        expect(utils.isMissing({})()).to.be.false;
        expect(utils.isMissing([])()).to.be.false;
    });

    it('should treat blank strings as "missing"', function () {
        expect(utils.isMissing('')()).to.be.true;
        expect(utils.isMissing('  ')()).to.be.true;

        // Not:
        expect(utils.isMissing(' /t ')()).to.be.false;
        expect(utils.isMissing('yo')()).to.be.false;
    });
});

describe('Test "isEmpty" factory function', function () {
    'use strict';

    it('should treat most falsey values as empty', function () {
        expect(utils.isEmpty()()).to.be.true;
        expect(utils.isEmpty(null)()).to.be.true;
        expect(utils.isEmpty(false)()).to.be.true;
        expect(utils.isEmpty('')()).to.be.true;
        expect(utils.isEmpty('  ')()).to.be.true;

        // NB! But not:
        expect(utils.isEmpty(0)()).to.be.false;
    });

    it('should treat empty objects as, yes "empty"', function () {
        expect(utils.isEmpty({})()).to.be.true;
        expect(utils.isEmpty({})()).to.be.true;

        // Not:
        expect(utils.isEmpty({ myProp: 0 })()).to.be.false;
    });

    it('should treat empty arrays as, yes "empty"', function () {
        expect(utils.isEmpty([])()).to.be.true;

        // Not:
        expect(utils.isEmpty([false])()).to.be.false;
        expect(utils.isEmpty([0])()).to.be.false;
    });
});
