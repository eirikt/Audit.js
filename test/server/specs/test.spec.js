/* global describe:false, it:false */
/* jshint -W024, -W030, -W126, -W116 */

var expect = require('chai').expect,

// 'SUT'
    hello = function () {
        'use strict';
        return 'Hello world!';
    };


describe('Test library', function () {
    'use strict';

    describe('Mocha', function () {
        it('should just work ...', function () {
        });
    });

    describe('Chai', function () {
        it('should use \'expect\' to check e.g. truthiness and equality', function () {
            expect(true).to.be.OK;
            expect(true).to.be.true;
            expect(1 === 1).to.be.true;
            expect(hello()).to.equal('Hello world!');
            expect(
                (function () {
                    return 1;
                }())
            ).to.equal(1);
        });
    });
});


describe('Test "falseyness"', function () {
    'use strict';

    it('should treat these as false by type coercion', function () {
        expect(true == false).to.be.false;

        expect(false == false).to.be.true;
        expect('' == false).to.be.true;
        expect('  ' == false).to.be.true;
        expect(0 == false).to.be.true;
        expect([] == false).to.be.true;

        // NB!
        expect({} == false).to.be.false;
    });
});
