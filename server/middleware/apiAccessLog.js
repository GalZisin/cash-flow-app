/**
 * API access log: one row per /api request in [log].cash_flow_api_access (db/log-schema.sql).
 *
 * For every request it
 *   - creates a request id (uuid v4, also returned in the X-Request-Id header),
 *   - opens a request context (utils/requestContext.js) so traced services / repositories
 *     can record the chain of inner methods they go through,
 *   - captures the request (query + body) and the response body (JSON or stream, capped),
 *   - when the response is finished (or the client went away) writes the row through
 *     repositories/apiAccessLog.repository.js. A failed write never affects the response.
 *
 * All timestamps are the LOCAL time of this machine. Disable with API_ACCESS_LOG=0,
 * cap payload size with API_ACCESS_LOG_MAX_CHARS (default 20000 characters per payload).
 */
const os = require('os');
const { StringDecoder } = require('string_decoder');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const requestContext = require('../utils/requestContext');
const repository = require('../repositories/apiAccessLog.repository');
const { localDateTimeToDb } = require('../db/helpers.pure');

const MACHINE_NAME = os.hostname();
const USER_NAME = (() => {
    try { return os.userInfo().username || 'local'; } catch { return 'local'; }
})();
const TRUNCATED = '...[truncated]';
// A path segment that is an entity id: uuid (the app's ids) or a plain number.
const ID_SEGMENT = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\d+)$/i;

/** Splits "/api/goals/<id>/analyze?x=1" into the route pattern and the first id in it. */
function describePath(originalUrl) {
    const pathname = (originalUrl || '/').split('?')[0];
    const segments = pathname.split('/').filter(Boolean);           // ['api', 'goals', '<id>', 'analyze']
    let entityId = null;
    const pattern = segments.map((segment) => {
        const decoded = safeDecode(segment);
        if (!ID_SEGMENT.test(decoded)) return segment;
        if (entityId === null) entityId = decoded;
        return ':id';
    });
    const afterApi = segments[0] === 'api' ? segments.slice(1) : segments;
    return {
        requestPath: pathname,
        routePattern: `/${pattern.join('/')}`,
        serviceName: afterApi[0] || 'api',
        entityId
    };
}

function safeDecode(text) {
    try { return decodeURIComponent(text); } catch { return text; }
}

function cut(text, maxChars) {
    if (text === null || text === undefined) return null;
    return text.length > maxChars ? text.slice(0, maxChars) + TRUNCATED : text;
}

function requestData(req, maxChars) {
    const data = {};
    if (req.query && Object.keys(req.query).length) data.query = req.query;
    if (req.body !== undefined) data.body = req.body;
    if (!Object.keys(data).length) return null;
    try {
        return cut(JSON.stringify(data), maxChars);
    } catch (err) {
        return `[unserializable request: ${err.message}]`;
    }
}

/** Collects what the server writes to the response (JSON or streamed text), up to maxChars. */
function captureResponse(res, maxChars) {
    const decoder = new StringDecoder('utf8');
    let text = '';
    let truncated = false;

    const push = (chunk) => {
        if (chunk === null || chunk === undefined || truncated) return;
        const piece = Buffer.isBuffer(chunk) ? decoder.write(chunk) : typeof chunk === 'string' ? chunk : '';
        if (!piece) return;
        const room = maxChars - text.length;
        if (piece.length > room) {
            text += piece.slice(0, room);
            truncated = true;
        } else {
            text += piece;
        }
    };

    // res.json / res.send: take the body here, BEFORE Express can drop it. When the browser's
    // ETag still matches, Express answers 304 Not Modified and sends no body at all, so the
    // wire-level capture below would see nothing.
    let sentBody = false;
    const send = res.send;
    res.send = function (body, ...rest) {
        if (!sentBody && (typeof body === 'string' || Buffer.isBuffer(body))) {
            sentBody = true;
            push(body);
        }
        return send.call(this, body, ...rest);
    };

    // Streams (e.g. /api/ai/chat-stream) write directly, without res.send.
    const write = res.write;
    const end = res.end;
    res.write = function (chunk, ...rest) {
        if (!sentBody) push(chunk);
        return write.call(this, chunk, ...rest);
    };
    res.end = function (chunk, ...rest) {
        if (!sentBody && typeof chunk !== 'function') push(chunk);
        return end.call(this, chunk, ...rest);
    };

    return () => (text.length ? (truncated ? text + TRUNCATED : text) : null);
}

/** "ErrorName: message" for the row - from the thrown error, or from the JSON error envelope. */
function describeError(res, responseText, aborted) {
    const err = res.locals && res.locals.error;
    if (err) {
        const head = `${err.name || 'Error'}: ${err.message || ''}`.trim();
        return res.statusCode >= 500 && err.stack ? `${head}\n${err.stack}` : head;
    }
    if (aborted) return 'Client closed the connection before the response was finished';
    if (res.statusCode < 400 || !responseText) return null;
    try {
        const body = JSON.parse(responseText);
        if (body && body.error) return `${body.error.name || 'Error'}: ${body.error.message || ''}`.trim();
    } catch { /* not JSON */ }
    return null;
}

function apiAccessLog({
    maxChars = Number(process.env.API_ACCESS_LOG_MAX_CHARS ?? 20_000),
    skipMethods = ['OPTIONS', 'HEAD'],
    repo = repository
} = {}) {
    let warned = false;

    return function apiAccessLogMiddleware(req, res, next) {
        if (skipMethods.includes(req.method)) return next();

        const store = { requestId: uuidv4(), startedAt: new Date(), calls: [], entityId: null };
        res.setHeader('X-Request-Id', store.requestId);
        const responseText = captureResponse(res, maxChars);

        let written = false;
        const writeRow = () => {
            if (written) return;
            written = true;

            const aborted = !res.writableFinished;
            const described = describePath(req.originalUrl);
            const response = responseText();
            const message = describeError(res, response, aborted);
            const status = res.headersSent ? res.statusCode : null;
            const bodyId = req.body && typeof req.body.id === 'string' ? req.body.id.slice(0, 50) : null;

            const entry = {
                request_id: store.requestId,
                user_name: USER_NAME,
                start_time: localDateTimeToDb(store.startedAt),
                service_name: described.serviceName.slice(0, 100),
                method_name: `${req.method} ${described.routePattern}`.slice(0, 256),
                inner_method_name: requestContext.callChain(store.calls, 2000, store.callsDropped),
                http_method: req.method.slice(0, 10),
                request_path: described.requestPath.slice(0, 512),
                request_data: requestData(req, maxChars),
                response_data: response,
                entity_id: store.entityId || described.entityId || bodyId,
                is_error: aborted || !!(res.locals && res.locals.error) || (status !== null && status >= 400),
                event_message: message,
                machine_name: MACHINE_NAME,
                ip_address: req.ip || (req.socket && req.socket.remoteAddress) || null,
                end_time: localDateTimeToDb(new Date()),
                status
            };

            Promise.resolve()
                .then(() => repo.insert(entry))
                .catch((err) => {
                    // First failure is a warning (usually: table missing / no DB); the rest stay quiet.
                    if (!warned) {
                        warned = true;
                        logger.warn(`API access log: could not write to log.cash_flow_api_access: ${err.message}`);
                    } else {
                        logger.debug(`API access log write failed: ${err.message}`);
                    }
                });
        };

        res.once('finish', writeRow);
        res.once('close', writeRow);

        requestContext.run(store, () => next());
    };
}

module.exports = apiAccessLog;
module.exports.describePath = describePath;
