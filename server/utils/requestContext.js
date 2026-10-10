/**
 * Per-request context (AsyncLocalStorage).
 *
 * The API access log middleware opens a context for every /api request; traced
 * service / repository methods (utils/traceMethods.js) record their names into it,
 * so the log row can show the chain of inner methods the request went through.
 * Outside a request (tests, scripts) every function here is a harmless no-op.
 */
const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

const MAX_CALLS = 200;        // distinct consecutive calls kept per request
const CHAIN_SEPARATOR = ' > ';

/** Runs fn inside the given store; the store is visible to everything fn triggers (promises included). */
function run(store, fn) {
    return storage.run(store, fn);
}

/** Current request store, or undefined outside a request. */
function get() {
    return storage.getStore();
}

/** Records a method call (e.g. "cashFlowService.saveCashFlow"); consecutive repeats are counted. */
function recordCall(name) {
    const store = storage.getStore();
    if (!store || !Array.isArray(store.calls)) return;
    const last = store.calls[store.calls.length - 1];
    if (last && last.name === name) {
        last.count += 1;
        return;
    }
    if (store.calls.length >= MAX_CALLS) {
        store.callsDropped = (store.callsDropped || 0) + 1;
        return;
    }
    store.calls.push({ name, count: 1 });
}

/** Marks the entity (installment / investment / goal / conversation id) the request works on. */
function setEntityId(id) {
    const store = storage.getStore();
    if (store && id !== undefined && id !== null) store.entityId = String(id);
}

/** "a > b x3 > c", cut to maxLength characters (null when nothing was recorded). */
function callChain(calls, maxLength = 2000, dropped = 0) {
    if (!calls || !calls.length) return null;
    let text = calls.map((c) => (c.count > 1 ? `${c.name} x${c.count}` : c.name)).join(CHAIN_SEPARATOR);
    if (dropped > 0) text += `${CHAIN_SEPARATOR}... +${dropped} more`;
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

module.exports = { run, get, recordCall, setEntityId, callChain };
