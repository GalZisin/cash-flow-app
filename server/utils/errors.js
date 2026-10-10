class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = 400;
    }
}

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NotFoundError';
        this.statusCode = 404;
    }
}

class InternalError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InternalError';
        this.statusCode = 500;
    }
}

/** A dependency (AI model server, database) is not reachable right now. */
class ServiceUnavailableError extends Error {
    constructor(message, code = 'SERVICE_UNAVAILABLE') {
        super(message);
        this.name = 'ServiceUnavailableError';
        this.statusCode = 503;
        this.code = code;
    }
}

class TooManyRequestsError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TooManyRequestsError';
        this.statusCode = 429;
        this.code = 'RATE_LIMITED';
    }
}

module.exports = {
    ValidationError,
    NotFoundError,
    InternalError,
    ServiceUnavailableError,
    TooManyRequestsError
};
