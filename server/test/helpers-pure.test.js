const { test } = require('node:test');
const assert = require('node:assert/strict');
const pure = require('../db/helpers.pure');

test('num / numOrNull', () => {
    assert.equal(pure.num('12.5'), 12.5);
    assert.equal(pure.num('abc'), 0);
    assert.equal(pure.num(undefined, 7), 7);
    assert.equal(pure.numOrNull(''), null);
    assert.equal(pure.numOrNull('3'), 3);
});

test('isoToDb strips the trailing Z and rejects garbage', () => {
    assert.equal(pure.isoToDb('2026-06-08T01:32:30.222Z'), '2026-06-08T01:32:30.222');
    assert.equal(pure.isoToDb('not a date'), null);
    assert.equal(pure.isoToDb(''), null);
});

test('extraJson keeps only unknown keys', () => {
    assert.equal(pure.extraJson({ a: 1, b: 2, c: undefined }, ['a']), '{"b":2}');
    assert.equal(pure.extraJson({ a: 1 }, ['a']), null);
});

test('groupBy keeps row order per key', () => {
    const map = pure.groupBy([{ k: 1, v: 'a' }, { k: 2, v: 'b' }, { k: 1, v: 'c' }], (r) => r.k);
    assert.deepEqual(map.get(1).map(r => r.v), ['a', 'c']);
    assert.deepEqual(map.get(2).map(r => r.v), ['b']);
});
