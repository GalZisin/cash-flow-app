const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const meta = { name: err.name, path: req.path, method: req.method };
    if (statusCode >= 500) {
        logger.error(err.message, { ...meta, stack: err.stack });
    } else {
        logger.warn(err.message, meta);
    }

    const message = err.message || 'Internal Server Error';

    res.status(statusCode).json({
        success: false,
        error: {
            name: err.name,
            message: message,
            ...(err.code && { code: err.code }),
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
}

module.exports = errorHandler;
