/**
 * traceMethods(target, name) wraps every method of a service / repository so that each
 * call is recorded in the current request context (utils/requestContext.js) as
 * "<name>.<method>". The log row's inner_method_name then shows the whole chain, e.g.
 *   cashFlowService.saveCashFlow > cashFlowRepository.write > goalsService.analyzeAllGoals
 *
 * Works on class instances (methods on the prototype chain, including "_private" helpers
 * that are called through `this`) and on plain objects of functions. JavaScript `#private`
 * methods cannot be intercepted and are not listed.
 *
 * The wrappers are defined as own properties, so `t.mock.method(obj, 'method')` in tests
 * keeps working exactly as before. Outside a request the wrappers only forward the call.
 */
const { recordCall } = require('./requestContext');

function collectMethods(target) {
    const found = new Map(); // key -> { fn, enumerable }
    let obj = target;
    while (obj && obj !== Object.prototype && obj !== Function.prototype) {
        for (const key of Object.getOwnPropertyNames(obj)) {
            if (key === 'constructor' || found.has(key)) continue;
            const desc = Object.getOwnPropertyDescriptor(obj, key);
            if (typeof desc.value === 'function') found.set(key, { fn: desc.value, enumerable: desc.enumerable });
        }
        obj = Object.getPrototypeOf(obj);
    }
    return found;
}

function traceMethods(target, name) {
    if (!target || (typeof target !== 'object' && typeof target !== 'function')) return target;
    if (!name) throw new Error('traceMethods: a name for the traced object is required');

    for (const [key, { fn, enumerable }] of collectMethods(target)) {
        const label = `${name}.${key}`;
        const traced = function (...args) {
            recordCall(label);
            return fn.apply(this, args);
        };
        Object.defineProperty(traced, 'name', { value: key, configurable: true });
        Object.defineProperty(target, key, { value: traced, writable: true, configurable: true, enumerable });
    }
    return target;
}

module.exports = traceMethods;
