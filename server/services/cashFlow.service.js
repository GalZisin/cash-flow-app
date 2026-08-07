const cashFlowRepository = require('../repositories/cashFlow.repository');
const { ValidationError } = require('../utils/errors');

class CashFlowService {
    async getCashFlow() {
        const data = await cashFlowRepository.read();

        // Business logic: ensure all months have loanPayment
        if (data && data.months) {
            data.months = data.months.map(m => ({
                loanPayment: 0,
                ...m
            }));
        }

        return data;
    }

    async saveCashFlow(data) {
        // Business logic: validate structure
        if (!data.months || !Array.isArray(data.months)) {
            throw new ValidationError('Invalid cash flow data structure');
        }

        await cashFlowRepository.write(data);
        return { success: true };
    }

    async getDefaults() {
        return await cashFlowRepository.readDefaults();
    }

    async saveDefaults(data) {
        // Business logic: normalize and validate
        const normalized = this.normalizeDefaults(data);
        await cashFlowRepository.writeDefaults(normalized);
        return normalized;
    }

    normalizeDefaults(data) {
        return {
            income: Number(data.income) || 0,
            mortgagePayment: Number(data.mortgagePayment) || 0,
            loanPayment: Number(data.loanPayment) || 0,
            additionalIncomes: (data.additionalIncomes || []).map(e => ({
                description: e.description ?? '',
                amount: Number(e.amount) || 0
            })),
            regularExpenses: (data.regularExpenses || []).map(e => ({
                description: e.description ?? '',
                amount: Number(e.amount) || 0,
                ...(e.category && { category: e.category })
            })),
            specialExpenses: (data.specialExpenses || []).map(e => ({
                description: e.description ?? '',
                amount: Number(e.amount) || 0,
                ...(e.category && { category: e.category })
            }))
        };
    }
}

module.exports = new CashFlowService();
