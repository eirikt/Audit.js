/* global describe:false, it:false */
/* jshint -W030, -W024, -W126 */

var expect = require("chai").expect,

// "SUT"
    hello = function () {
        "use strict";
        return "Hello world!";
    };

describe("Trying out the test libraries", function () {
    'use strict';

    describe("Mocha", function () {
        it("should just work ...", function () {
        });
    });

    describe("Chai", function () {
        it("should use 'expect' to check e.g. truthiness and equality", function () {
            expect(true).to.be.OK;
            expect(true).to.be.true;
            expect(1 === 1).to.be.true;
            expect(hello()).to.equal("Hello world!");
            expect(
                (function () {
                    return 1;
                }())
            ).to.equal(1);
        });
    });
});
