const installmentsRepository = require('../repositories/installments.repository');
const { NotFoundError, ValidationError } = require('../utils/errors');

class InstallmentsService {
    async getAll() {
        return await installmentsRepository.findAll();
    }

    async getById(id) {
        const installment = await installmentsRepository.findById(id);
        if (!installment) {
            throw new NotFoundError(`Installment with id ${id} not found`);
        }
        return installment;
    }

    async create(data) {
        // Validate required fields
        if (!data.name || data.name.trim() === '') {
            throw new ValidationError('Name is required');
        }

        // Normalize and create
        const installment = this.normalizeInstallment(data);
        installment.id = Date.now().toString();

        return await installmentsRepository.create(installment);
    }

    async update(id, data) {
        // Check if exists
        const existing = await installmentsRepository.findById(id);
        if (!existing) {
            throw new NotFoundError(`Installment with id ${id} not found`);
        }

        // Normalize update data
        const normalized = this.normalizeInstallment(data, existing);
        const updated = await installmentsRepository.update(id, normalized);

        return updated;
    }

    async delete(id) {
        const deleted = await installmentsRepository.delete(id);
        if (!deleted) {
            throw new NotFoundError(`Installment with id ${id} not found`);
        }
        return { success: true };
    }

    normalizeInstallment(data, existing = {}) {
        return {
            name: data.name ?? existing.name ?? '',
            totalAmount: Number(data.totalAmount ?? existing.totalAmount) || 0,
            downPayment: Number(data.downPayment ?? existing.downPayment) || 0,
            monthlyPayment: Number(data.monthlyPayment ?? existing.monthlyPayment) || 0,
            installmentsCount: Number(data.installmentsCount ?? existing.installmentsCount) || 0,
            startDate: data.startDate ?? existing.startDate ?? new Date().toISOString().slice(0, 10),
            color: data.color ?? existing.color ?? '#4f6ef7',
            notes: data.notes ?? existing.notes ?? '',
            manualPaidCount: Number(data.manualPaidCount ?? existing.manualPaidCount) || 0,
            lastManualPaymentDate: data.lastManualPaymentDate ?? existing.lastManualPaymentDate ?? undefined,
            paymentType: data.paymentType ?? existing.paymentType ?? 'manual',
            loanComponents: data.loanComponents ?? existing.loanComponents ?? [],
            milestones: data.milestones ?? existing.milestones ?? [],
            milestonePayments: data.milestonePayments ?? existing.milestonePayments ?? [],
            payments: data.payments ?? existing.payments ?? []
        };
    }
}

module.exports = new InstallmentsService();
