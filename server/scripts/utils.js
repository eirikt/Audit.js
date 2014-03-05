// Generic helper functions


/** @returns {string} The percentage with the given precision */
var getPercentage = exports.getPercentage = function (number, totalNumber, precision) {
    return (number / totalNumber * 100).toFixed(precision || 1);
};


/**
 * Invoke the given callback function only when the iteration number is a natural number ratio of the total iteration number.
 *
 * @param numberOfThrottledEvents number of events to let through
 * @param iterationNo current event number
 * @param totalIterationNo total number of events expected
 * @param callback function with progress percentage value as parameter
 */
var throttleEvents = exports.throttleEvents = function (numberOfThrottledEvents, iterationNo, totalIterationNo, callback) {
    var skippingInterval,
        doEmit,
        progressValueProgressInPercent;

    if (numberOfThrottledEvents <= 100 && totalIterationNo <= numberOfThrottledEvents) {
        callback(iterationNo);

    } else {
        skippingInterval = Math.floor(totalIterationNo / numberOfThrottledEvents);
        doEmit = iterationNo % skippingInterval === 0;
    }

    if (doEmit && callback) {
        if (numberOfThrottledEvents > 100) {
            progressValueProgressInPercent = getPercentage(iterationNo, totalIterationNo);
        } else {
            progressValueProgressInPercent = Math.ceil(iterationNo / totalIterationNo * 100);
        }
        callback(progressValueProgressInPercent);
    }
};
