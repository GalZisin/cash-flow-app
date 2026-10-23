const investmentsRepository = require('../repositories/investments.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');
const traceMethods = require('../utils/traceMethods');

const TX_TYPES = ['deposit', 'withdraw'];

const byDate = (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime();
const byFromMonth = (a, b) => a.fromMonth - b.fromMonth;

function isNumber(value) {
    return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function normalizeSnapshot(data, id) {
    if (!data || !data.date || !isNumber(data.value)) {
        throw new ValidationError('Snapshot requires date and a numeric value');
    }
    return { id, date: String(data.date), value: Number(data.value) };
}

function normalizeTransaction(data, id) {
    if (!data || !data.date || !isNumber(data.amount) || !TX_TYPES.includes(data.type)) {
        throw new ValidationError(`Transaction requires date, a numeric amount and type (${TX_TYPES.join(' | ')})`);
    }
    return { id, date: String(data.date), amount: Number(data.amount), type: data.type };
}

function normalizeRule(data, id, existing = {}) {
    const pick = (key, fallback) => (isNumber(data?.[key]) ? Number(data[key]) : (existing[key] ?? fallback));
    return {
        id,
        fromMonth: Math.trunc(pick('fromMonth', 1)),
        toMonth: Math.trunc(pick('toMonth', 12)),
        monthlyAmount: pick('monthlyAmount', 0),
        oneTimeAmount: pick('oneTimeAmount', 0),
        description: data?.description ?? existing.description ?? ''
    };
}

/** Child collections of an investment: list key, normalizer, sort order and the error label. */
const CHILDREN = {
    snapshot: { key: 'snapshots', normalize: normalizeSnapshot, sort: byDate, label: 'Snapshot' },
    transaction: { key: 'transactions', normalize: normalizeTransaction, sort: byDate, label: 'Transaction' },
    rule: { key: 'simulationRules', normalize: normalizeRule, sort: byFromMonth, label: 'Simulation rule' }
};

class InvestmentsService {
    async getAll() {
        return await investmentsRepository.findAll();
    }

    async getById(id) {
        const investment = await investmentsRepository.findById(id);
        if (!investment) {
            throw new NotFoundError(`Investment with id ${id} not found`);
        }
        return investment;
    }

    async create(data) {
        if (!data.name || data.name.trim() === '') {
            throw new ValidationError('Name is required');
        }

        const investment = {
            id: uuidv4(),
            name: data.name.trim(),
            type: data.type || 'other',
            transactions: (data.transactions || []).map((t) => normalizeTransaction(t, t.id || uuidv4())).sort(byDate),
            snapshots: (data.snapshots || []).map((s) => normalizeSnapshot(s, s.id || uuidv4())).sort(byDate),
            simulationRules: (data.simulationRules || []).map((r) => normalizeRule(r, r.id || uuidv4())).sort(byFromMonth)
        };
        if (isNumber(data.initialValue)) investment.initialValue = Number(data.initialValue);
        if (isNumber(data.annualReturn)) investment.annualReturn = Number(data.annualReturn);

        return await investmentsRepository.create(investment);
    }

    /** Partial update: only the fields sent are changed, the repository keeps the rest. */
    async update(id, data) {
        await this.getById(id);

        const changes = {};
        if (data.name !== undefined) {
            if (!String(data.name).trim()) throw new ValidationError('Name is required');
            changes.name = String(data.name).trim();
        }
        if (data.type !== undefined) changes.type = data.type;
        if (data.initialValue !== undefined) changes.initialValue = isNumber(data.initialValue) ? Number(data.initialValue) : null;
        if (data.annualReturn !== undefined) changes.annualReturn = isNumber(data.annualReturn) ? Number(data.annualReturn) : null;
        if (Array.isArray(data.transactions)) {
            changes.transactions = data.transactions.map((t) => normalizeTransaction(t, t.id || uuidv4())).sort(byDate);
        }
        if (Array.isArray(data.snapshots)) {
            changes.snapshots = data.snapshots.map((s) => normalizeSnapshot(s, s.id || uuidv4())).sort(byDate);
        }
        if (Array.isArray(data.simulationRules)) {
            changes.simulationRules = data.simulationRules.map((r) => normalizeRule(r, r.id || uuidv4())).sort(byFromMonth);
        }

        return await investmentsRepository.update(id, changes);
    }

    async delete(id) {
        const deleted = await investmentsRepository.delete(id);
        if (!deleted) {
            throw new NotFoundError(`Investment with id ${id} not found`);
        }
        return { success: true };
    }

    // --- Child items (snapshot / transaction / simulation rule). Each returns the updated investment. ---

    async addChild(kind, id, data) {
        const { key, normalize, sort } = CHILDREN[kind];
        const investment = await this.getById(id);
        const list = [...(investment[key] || []), normalize(data, uuidv4())].sort(sort);
        return await investmentsRepository.update(id, { [key]: list });
    }

    async updateChild(kind, id, childId, data) {
        const { key, normalize, sort, label } = CHILDREN[kind];
        const investment = await this.getById(id);
        const list = [...(investment[key] || [])];
        const index = list.findIndex((item) => item.id === childId);
        if (index === -1) {
            throw new NotFoundError(`${label} with id ${childId} not found`);
        }
        list[index] = normalize(data, childId, list[index]);
        return await investmentsRepository.update(id, { [key]: list.sort(sort) });
    }

    async deleteChild(kind, id, childId) {
        const { key, label } = CHILDREN[kind];
        const investment = await this.getById(id);
        const list = investment[key] || [];
        const remaining = list.filter((item) => item.id !== childId);
        if (remaining.length === list.length) {
            throw new NotFoundError(`${label} with id ${childId} not found`);
        }
        return await investmentsRepository.update(id, { [key]: remaining });
    }
}

module.exports = traceMethods(new InvestmentsService(), 'investmentsService');
