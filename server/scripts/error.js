var handleError = exports.handle =
    function (err, options) {
        'use strict';

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
                options.response.status(500).send({ error: err.message });
            } else {
                options.response.status(500).send({ error: err });
            }
            return false;
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
