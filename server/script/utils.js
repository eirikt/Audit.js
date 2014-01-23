// Generic helper functions

/**
 * Invoke the given callback function only when the iteration number is a natural number percentage value of the total iteration number.
 *
 * @param numberOfThrottledEvents number of events to let through
 * @param iterationNo current event number
 * @param totalIterationNo total number of events expected
 * @param callback function with progress percentage value as parameter
 */
var throttleEvents = exports.throttleEvents = function (numberOfThrottledEvents, iterationNo, totalIterationNo, callback) {
    var skippingInterval, doEmit, progressValueProgressInPercent;
    if (numberOfThrottledEvents <= 100 && totalIterationNo <= numberOfThrottledEvents) {
        callback(iterationNo);

    } else {
        skippingInterval = Math.floor(totalIterationNo / numberOfThrottledEvents);
        doEmit = iterationNo % skippingInterval === 0;
    }

    if (doEmit && callback) {
        if (numberOfThrottledEvents > 100) {
            progressValueProgressInPercent = (iterationNo / totalIterationNo * 100).toFixed(1);
        } else {
            progressValueProgressInPercent = Math.ceil(iterationNo / totalIterationNo * 100);
        }
        callback(progressValueProgressInPercent);
    }
};
