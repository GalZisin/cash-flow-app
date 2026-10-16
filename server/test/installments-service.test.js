const { test } = require('node:test');
const assert = require('node:assert/strict');
const installmentsRepository = require('../repositories/installments.repository');
const installmentsService = require('../services/installments.service');

test('normalizeInstallment keeps paymentOverrides and linkedGoalId on create', async (t) => {
    const create = t.mock.method(installmentsRepository, 'create', async (data) => data);
    const overrides = [{ key: 'm:1', status: 'skipped' }];
    const saved = await installmentsService.create({ name: 'TV', paymentOverrides: overrides, linkedGoalId: 'g1' });
    assert.equal(create.mock.callCount(), 1);
    assert.deepEqual(saved.paymentOverrides, overrides);
    assert.equal(saved.linkedGoalId, 'g1');
});

test('normalizeInstallment on update: new values win, missing ones fall back to the stored record', async (t) => {
    const existing = { id: '1', name: 'TV', paymentOverrides: [{ key: 'm:1', status: 'skipped' }], linkedGoalId: 'g1' };
    t.mock.method(installmentsRepository, 'findById', async () => existing);
    const update = t.mock.method(installmentsRepository, 'update', async (id, data) => data);

    const kept = await installmentsService.update('1', { name: 'TV 2' });
    assert.deepEqual(kept.paymentOverrides, existing.paymentOverrides);
    assert.equal(kept.linkedGoalId, 'g1');

    const changed = await installmentsService.update('1', { paymentOverrides: [], linkedGoalId: 'g2' });
    assert.deepEqual(changed.paymentOverrides, []);
    assert.equal(changed.linkedGoalId, 'g2');
    assert.equal(update.mock.callCount(), 2);
});

test('normalizeInstallment defaults paymentOverrides to an empty array', () => {
    assert.deepEqual(installmentsService.normalizeInstallment({ name: 'x' }).paymentOverrides, []);
});
