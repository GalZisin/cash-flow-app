/**
 * Pure helpers (no database, no side effects) - shared by helpers.js and mappers.js.
 */

const num = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const numOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

const strOrNull = (value) => (value === undefined || value === null ? null : String(value));

const boolOrNull = (value) => (value === undefined || value === null ? null : Boolean(value));

/** ISO timestamp -> value for a ts column ('2026-06-08T01:32:30.222'), null if empty/invalid */
const isoToDb = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, -1);
};

const jsonOrNull = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

const parseJson = (text) => (text === undefined || text === null || text === '' ? undefined : JSON.parse(text));

/** Keys of `obj` that are not in `known`, as a JSON string (or null if there are none). */
function extraJson(obj, known) {
    const extra = {};
    for (const key of Object.keys(obj || {})) {
        if (!known.includes(key) && obj[key] !== undefined) extra[key] = obj[key];
    }
    return Object.keys(extra).length ? JSON.stringify(extra) : null;
}

/** Sets obj[key] only when value is not null/undefined (keeps optional fields optional). */
function setIf(obj, key, value) {
    if (value !== null && value !== undefined) obj[key] = value;
    return obj;
}

/** Groups rows by a key column: Map<key, row[]> (keeps the query's row order). */
function groupBy(list, keyOf) {
    const map = new Map();
    for (const item of list) {
        const key = keyOf(item);
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(item);
    }
    return map;
}

module.exports = {
    num, numOrNull, strOrNull, boolOrNull, isoToDb, jsonOrNull, parseJson, extraJson, setIf, groupBy
};
