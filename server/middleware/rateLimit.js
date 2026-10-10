/**
 * Small in-memory rate limiter (per client IP, fixed window).
 * Enough for a single-user / single-process app; swap for express-rate-limit + a store
 * if the server is ever run behind a load balancer with several instances.
 */
const { TooManyRequestsError } = require('../utils/errors');

function rateLimit({ windowMs = 60_000, max = 20, message = 'Too many requests, please try again shortly.' } = {}) {
    const hits = new Map(); // ip -> { count, resetAt }

    // Forget idle clients so the map cannot grow forever.
    const sweeper = setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
    }, windowMs);
    sweeper.unref();

    return function rateLimitMiddleware(req, res, next) {
        const now = Date.now();
        const ip = req.ip || req.socket?.remoteAddress || 'unknown';
        let entry = hits.get(ip);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(ip, entry);
        }
        entry.count += 1;

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));

        if (entry.count > max) {
            res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
            return next(new TooManyRequestsError(message));
        }
        next();
    };
}

module.exports = rateLimit;
