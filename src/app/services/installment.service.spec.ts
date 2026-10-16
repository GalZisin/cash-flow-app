import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { InstallmentService } from './installment.service';
import { Installment, LoanComponent } from '../models/installment.model';

function makeItem(overrides: Partial<Installment> = {}): Installment {
    return {
        id: 'i1',
        name: 'Test',
        totalAmount: 0,
        downPayment: 0,
        monthlyPayment: 0,
        installmentsCount: 0,
        startDate: '',
        color: '#000',
        notes: '',
        manualPaidCount: 0,
        loanComponents: [],
        ...overrides
    };
}

function makeLoan(overrides: Partial<LoanComponent>): LoanComponent {
    return {
        id: 'a',
        description: 'Loan',
        totalLoanAmount: 0,
        monthlyPayment: 0,
        installmentsCount: 0,
        startDate: '',
        paidCount: 0,
        ...overrides
    };
}

// היום הקבוע: 16/10/2026 (תאריך מקומי)
const TODAY = new Date(2026, 9, 16);

describe('InstallmentService', () => {
    let service: InstallmentService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(InstallmentService);
    });

    describe('getStatus', () => {
        it('a plan starting in the future with a down payment has no progress', () => {
            const item = makeItem({ paymentType: 'manual', startDate: '2026-12-01', downPayment: 3000, installmentsCount: 10, monthlyPayment: 700, totalAmount: 10000 });
            const status = service.getStatus(item, TODAY);
            expect(status.progressPct).toBe(0);
            expect(status.paidAmount).toBe(0);
            expect(status.paidInstallments).toBe(0);
            expect(status.remainingAmount).toBe(10000);
            expect(status.isCompleted).toBeFalse();
            expect(status.monthsLeft).toBe(10);
            expect(status.combinedPaymentHistory).toEqual([]);
            expect(status.upcomingPayments.length).toBe(11); // מקדמה + 10
        });

        it('a manual plan started 3 months ago has 4 payments paid (the start month counts)', () => {
            const item = makeItem({ paymentType: 'manual', startDate: '2026-07-10', installmentsCount: 12, monthlyPayment: 1000, totalAmount: 12000 });
            const status = service.getStatus(item, TODAY);
            expect(status.paidInstallments).toBe(4);
            expect(status.totalInstallments).toBe(12);
            expect(status.paidAmount).toBe(4000);
            expect(status.remainingAmount).toBe(8000);
            expect(status.progressPct).toBe(33);
            expect(status.monthsLeft).toBe(8);
            expect(status.isCompleted).toBeFalse();
            expect(status.endDate).toBe('2027-06');
            expect(status.combinedPaymentHistory.map(p => p.date)).toEqual(['2026-07-10', '2026-08-10', '2026-09-10', '2026-10-10']);
            expect(status.combinedPaymentHistory.every(p => p.source === 'auto' && p.type === 'manual')).toBeTrue();
            expect(status.upcomingPayments.length).toBe(8);
            expect(status.upcomingPayments[0]).toEqual(jasmine.objectContaining({ key: 'm:5', date: '2026-11-10', amount: 1000 }));
        });

        it('a manual plan whose day of month has not arrived yet in the current month', () => {
            const item = makeItem({ paymentType: 'manual', startDate: '2026-07-20', installmentsCount: 12, monthlyPayment: 1000 });
            expect(service.getStatus(item, TODAY).paidInstallments).toBe(3);
        });

        it('a manual plan completes after the last payment date', () => {
            const item = makeItem({ paymentType: 'manual', startDate: '2026-01-01', downPayment: 500, installmentsCount: 3, monthlyPayment: 100 });
            const status = service.getStatus(item, TODAY);
            expect(status.isCompleted).toBeTrue();
            expect(status.progressPct).toBe(100);
            expect(status.paidAmount).toBe(800);
            expect(status.remainingAmount).toBe(0);
            expect(status.monthsLeft).toBe(0);
        });

        describe('loan plan', () => {
            const loanA = makeLoan({ id: 'a', monthlyPayment: 500, installmentsCount: 12, startDate: '2026-01-05' });
            const loanB = makeLoan({ id: 'b', monthlyPayment: 200, installmentsCount: 3, startDate: '2026-09-01' });
            const item = makeItem({ paymentType: 'loan', loanComponents: [loanA, loanB] });

            it('computes per-loan progress and monthsLeft', () => {
                const status = service.getStatus(item, TODAY);
                const [a, b] = status.loanStatuses;

                expect(a.paidInstallments).toBe(10);
                expect(a.monthsLeft).toBe(2);
                expect(a.paidAmount).toBe(5000);
                expect(a.remainingAmount).toBe(1000);
                expect(a.progressPct).toBe(83);
                expect(a.isCompleted).toBeFalse();
                expect(a.history.length).toBe(10);
                expect(a.upcoming.length).toBe(2);

                expect(b.paidInstallments).toBe(2);
                expect(b.monthsLeft).toBe(1);
                expect(b.progressPct).toBe(67);

                expect(status.monthsLeft).toBe(2);
                expect(status.totalInstallments).toBe(12);
                expect(status.paidAmount).toBe(5400);
                expect(status.isCompleted).toBeFalse();
            });

            it('is completed after all payments', () => {
                const status = service.getStatus(item, new Date(2027, 0, 5));
                expect(status.loanStatuses.every(s => s.isCompleted)).toBeTrue();
                expect(status.isCompleted).toBeTrue();
                expect(status.monthsLeft).toBe(0);
                expect(status.progressPct).toBe(100);
            });

            it('a payoff ends the loan early and counts as completed', () => {
                const payoffItem = makeItem({
                    paymentType: 'loan',
                    loanComponents: [makeLoan({ id: 'a', monthlyPayment: 500, installmentsCount: 12, startDate: '2026-01-05', payoffDate: '2026-06', payoffAmount: 3000 })]
                });
                const status = service.getStatus(payoffItem, TODAY);
                const a = status.loanStatuses[0];
                expect(a.isCompleted).toBeTrue();
                expect(a.monthsLeft).toBe(0);
                expect(a.paidAmount).toBe(5 * 500 + 3000);
                expect(a.remainingAmount).toBe(0);
                expect(status.isCompleted).toBeTrue();
                expect(status.combinedPaymentHistory[status.combinedPaymentHistory.length - 1].key).toBe('l:a:payoff');
            });
        });

        it('milestone plan (kitchen): a future milestone paid early via legacy milestonePayments counts as paid', () => {
            const item = makeItem({
                paymentType: 'milestone',
                totalAmount: 26000,
                milestones: [
                    { id: 'm1', description: 'Order', percentage: 40, amount: 10400, date: '2026-11' },
                    { id: 'm2', description: 'Delivery', percentage: 40, amount: 10400, date: '2027-02' },
                    { id: 'm3', description: 'Install', percentage: 20, amount: 5200, date: '2027-06' }
                ],
                milestonePayments: [{ milestoneId: 'm1', date: '2026-09-20', amount: 10400 }]
            });
            const status = service.getStatus(item, TODAY);
            expect(status.paidAmount).toBe(10400);
            expect(status.progressPct).toBe(40);
            expect(status.progressPct).toBeGreaterThan(0);
            expect(status.paidMilestonesCount).toBe(1);
            expect(status.remainingAmount).toBe(15600);
            expect(status.combinedPaymentHistory).toEqual([
                jasmine.objectContaining({ key: 'ms:m1', date: '2026-09-20', dueDate: '2026-11-01', amount: 10400, source: 'manual', milestoneId: 'm1' })
            ]);
            expect(status.upcomingPayments.map(p => p.key)).toEqual(['ms:m2', 'ms:m3']);
            expect(status.isCompleted).toBeFalse();
            expect(status.endDate).toBe('2027-06');
        });

        it('a new milestone plan whose first milestone is in the future shows no progress until it is due or paid', () => {
            const item = makeItem({
                paymentType: 'milestone',
                totalAmount: 30000,
                downPayment: 3000,
                startDate: '2026-12-01',
                milestones: [
                    { id: 'm1', description: 'First', percentage: 50, amount: 13500, date: '2026-12' },
                    { id: 'm2', description: 'Second', percentage: 50, amount: 13500, date: '2027-03' }
                ]
            });
            const before = service.getStatus(item, TODAY);
            expect(before.progressPct).toBe(0);
            expect(before.paidAmount).toBe(0);
            expect(before.paidMilestonesCount).toBe(0);
            expect(before.combinedPaymentHistory).toEqual([]);

            const onFirstMilestone = service.getStatus(item, new Date(2026, 11, 1));
            expect(onFirstMilestone.paidAmount).toBe(3000 + 13500);
            expect(onFirstMilestone.progressPct).toBe(55);
            expect(onFirstMilestone.paidMilestonesCount).toBe(1);
        });
    });

    describe('payment actions', () => {
        let updateSpy: jasmine.Spy;

        beforeEach(() => {
            jasmine.clock().install();
            jasmine.clock().mockDate(new Date(2026, 9, 16, 12, 0, 0));
            updateSpy = spyOn(service, 'update').and.callFake((_id: string, item: Installment) => of(item));
        });

        afterEach(() => jasmine.clock().uninstall());

        const savedItem = (): Installment => updateSpy.calls.mostRecent().args[1];

        const manualPlan = () => makeItem({ paymentType: 'manual', startDate: '2026-07-10', installmentsCount: 12, monthlyPayment: 1000 });

        it('markAsPaid marks the next unpaid payment', () => {
            service.markAsPaid(manualPlan(), '2026-10-16').subscribe();
            expect(updateSpy).toHaveBeenCalledTimes(1);
            expect(updateSpy.calls.mostRecent().args[0]).toBe('i1');
            expect(savedItem().paymentOverrides).toEqual([{ key: 'm:5', status: 'paid', date: '2026-10-16' }]);
            expect(savedItem().milestonePayments).toEqual([]);
        });

        it('markAsPaid picks a skipped payment first and replaces its override', () => {
            const item = makeItem({ ...manualPlan(), paymentOverrides: [{ key: 'm:3', status: 'skipped' }] });
            service.markAsPaid(item, '2026-10-16').subscribe();
            expect(savedItem().paymentOverrides).toEqual([{ key: 'm:3', status: 'paid', date: '2026-10-16' }]);
        });

        it('markAsPaid with loanId only looks at that loan', () => {
            const item = makeItem({
                paymentType: 'loan',
                loanComponents: [
                    makeLoan({ id: 'a', monthlyPayment: 500, installmentsCount: 12, startDate: '2026-01-05' }),
                    makeLoan({ id: 'b', monthlyPayment: 200, installmentsCount: 12, startDate: '2026-10-25' })
                ]
            });
            service.markAsPaid(item, '2026-10-16', 'a').subscribe();
            expect(savedItem().paymentOverrides).toEqual([{ key: 'l:a:11', status: 'paid', date: '2026-10-16' }]);
        });

        it('markAsPaid returns null and does not save when everything is paid', () => {
            let result: Installment | null | undefined;
            service.markAsPaid(makeItem({ paymentType: 'manual', startDate: '2026-01-01', installmentsCount: 2, monthlyPayment: 1 }), '2026-10-16')
                .subscribe(r => result = r);
            expect(result).toBeNull();
            expect(updateSpy).not.toHaveBeenCalled();
        });

        it('undoPayment on an auto-paid payment produces a skipped override', () => {
            service.undoPayment(manualPlan()).subscribe();
            expect(savedItem().paymentOverrides).toEqual([{ key: 'm:4', status: 'skipped' }]);
            expect(savedItem().milestonePayments).toEqual([]);
        });

        it('undoPayment on an early-paid future payment removes the override', () => {
            const item = makeItem({ ...manualPlan(), paymentOverrides: [{ key: 'm:5', status: 'paid', date: '2026-10-14' }] });
            service.undoPayment(item).subscribe();
            expect(savedItem().paymentOverrides).toEqual([]);
        });

        const kitchen = () => makeItem({
            paymentType: 'milestone',
            milestones: [
                { id: 'm1', description: 'Order', percentage: 40, amount: 10400, date: '2026-11' },
                { id: 'm2', description: 'Delivery', percentage: 60, amount: 15600, date: '2027-02' }
            ],
            milestonePayments: [{ milestoneId: 'm1', date: '2026-09-20', amount: 10400 }]
        });

        it('undoMilestonePayment on an early-paid future milestone just removes the override', () => {
            service.undoMilestonePayment(kitchen(), 'm1').subscribe();
            expect(savedItem().paymentOverrides).toEqual([]);
            expect(savedItem().milestonePayments).toEqual([]);
            expect(service.getStatus(savedItem(), new Date(2026, 9, 16)).paidAmount).toBe(0);
        });

        it('undoMilestonePayment on a past milestone produces a skipped override', () => {
            const item = makeItem({
                paymentType: 'milestone',
                milestones: [{ id: 'm1', description: '', percentage: 100, amount: 100, date: '2026-03' }]
            });
            service.undoMilestonePayment(item, 'm1').subscribe();
            expect(savedItem().paymentOverrides).toEqual([{ key: 'ms:m1', status: 'skipped' }]);
        });

        it('undoMilestonePayment on an unknown id removes the matching extra payment', () => {
            const item = makeItem({ paymentOverrides: [{ key: 'x:p1', status: 'paid', date: '2026-10-01', amount: 5 }] });
            service.undoMilestonePayment(item, 'p1').subscribe();
            expect(savedItem().paymentOverrides).toEqual([]);
        });

        it('markMilestoneAsPaid keeps the legacy payments as overrides and adds the new one', () => {
            service.markMilestoneAsPaid(kitchen(), 'm2', '2026-10-16', 15000, 'Delivery').subscribe();
            expect(savedItem().paymentOverrides).toEqual([
                { key: 'ms:m1', status: 'paid', date: '2026-09-20', amount: 10400, description: undefined },
                { key: 'ms:m2', status: 'paid', date: '2026-10-16', amount: 15000 }
            ]);
            expect(savedItem().milestonePayments).toEqual([]);
        });

        it('markMilestoneAsPaid stores a changed description and ignores unknown milestones', () => {
            service.markMilestoneAsPaid(kitchen(), 'm2', '2026-10-16', undefined, 'Partial').subscribe();
            expect(savedItem().paymentOverrides![1]).toEqual({ key: 'ms:m2', status: 'paid', date: '2026-10-16', description: 'Partial' });

            updateSpy.calls.reset();
            let result: Installment | null | undefined;
            service.markMilestoneAsPaid(kitchen(), 'nope', '2026-10-16').subscribe(r => result = r);
            expect(result).toBeNull();
            expect(updateSpy).not.toHaveBeenCalled();
        });

        it('addAdHocMilestonePayment saves an x: override', () => {
            service.addAdHocMilestonePayment(makeItem(), 'p9', '2026-10-02', 300, 'Extra').subscribe();
            expect(savedItem().paymentOverrides).toEqual([{ key: 'x:p9', status: 'paid', date: '2026-10-02', amount: 300, description: 'Extra' }]);
            expect(savedItem().milestonePayments).toEqual([]);
        });

        it('undoPaymentByKey on an x: payment removes it, on a scheduled key marks it unpaid', () => {
            const item = makeItem({ ...manualPlan(), paymentOverrides: [{ key: 'x:p1', status: 'paid', date: '2026-10-01', amount: 5 }] });
            service.undoPaymentByKey(item, 'x:p1').subscribe();
            expect(savedItem().paymentOverrides).toEqual([]);

            service.undoPaymentByKey(item, 'm:2').subscribe();
            expect(savedItem().paymentOverrides).toEqual([
                { key: 'x:p1', status: 'paid', date: '2026-10-01', amount: 5 },
                { key: 'm:2', status: 'skipped' }
            ]);
        });

        it('resetPayment removes the override for the key', () => {
            const item = makeItem({ ...manualPlan(), paymentOverrides: [{ key: 'm:2', status: 'skipped' }, { key: 'm:6', status: 'paid', date: '2026-10-01' }] });
            service.resetPayment(item, 'm:2').subscribe();
            expect(savedItem().paymentOverrides).toEqual([{ key: 'm:6', status: 'paid', date: '2026-10-01' }]);
            expect(savedItem().milestonePayments).toEqual([]);
        });
    });
});
