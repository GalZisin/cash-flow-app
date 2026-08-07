const investmentsRepository = require('../repositories/investments.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');

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
            id: Date.now().toString(),
            name: data.name,
            initialAmount: Number(data.initialAmount) || 0,
            currentAmount: Number(data.currentAmount) || 0,
            currency: data.currency || 'ILS',
            type: data.type || 'other',
            startDate: data.startDate || new Date().toISOString().slice(0, 10),
            notes: data.notes || ''
        };

        return await investmentsRepository.create(investment);
    }

    async update(id, data) {
        const existing = await investmentsRepository.findById(id);
        if (!existing) {
            throw new NotFoundError(`Investment with id ${id} not found`);
        }

        const updated = {
            name: data.name ?? existing.name,
            initialAmount: data.initialAmount !== undefined ? Number(data.initialAmount) : existing.initialAmount,
            currentAmount: data.currentAmount !== undefined ? Number(data.currentAmount) : existing.currentAmount,
            currency: data.currency ?? existing.currency,
            type: data.type ?? existing.type,
            startDate: data.startDate ?? existing.startDate,
            notes: data.notes ?? existing.notes
        };

        return await investmentsRepository.update(id, updated);
    }

    async delete(id) {
        const deleted = await investmentsRepository.delete(id);
        if (!deleted) {
            throw new NotFoundError(`Investment with id ${id} not found`);
        }
        return { success: true };
    }
}

module.exports = new InvestmentsService();
