var handleError = exports.handle = function (error, options) {
    if (!error) {
        return false;
    }
    var hasErrorMessage = error.message;
    if (hasErrorMessage) {
        console.warn(error.message);
    } else {
        console.warn(error);
    }
    if (!options) {
        throw new Error(error);
    }
    if (options && options.response) {
        if (hasErrorMessage) {
            options.response.send(500, { error: error.message });
        } else {
            options.response.send(500, { error: error });
        }
    }
    if (options && options.deferred) {
        if (hasErrorMessage) {
            options.deferred.reject(error.message);
        } else {
            options.deferred.reject(error);
        }
    }
    return true;
};
