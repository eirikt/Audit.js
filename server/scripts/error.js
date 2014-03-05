var handleError = exports.handle = function (err, options) {
    if (!err) {
        return false;
    }
    var hasErrorMessage = err.message;
    if (hasErrorMessage) {
        console.warn(err.message);
    } else {
        console.warn(err);
    }
    if (!options) {
        throw new Error(err);
    }
    if (options && options.response) {
        if (hasErrorMessage) {
            options.response.send(500, { error: err.message });
        } else {
            options.response.send(500, { error: err });
        }
    }
    if (options && options.deferred) {
        if (hasErrorMessage) {
            options.deferred.reject(err.message);
        } else {
            options.deferred.reject(err);
        }
    }
    return true;
};
