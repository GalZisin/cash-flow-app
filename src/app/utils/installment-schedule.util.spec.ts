import { Installment } from '../models/installment.model';
import {
    addMonthsClamped,
    buildSchedule,
    getOverrides,
    overridesAfterReset,
    overridesAfterUnpay,
    resolvePayments,
    toIsoDate
} from './installment-schedule.util';

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

// היום הקבוע לכל הבדיקות: 16/10/2026 (תאריך מקומי)
const TODAY = new Date(2026, 9, 16);

describe('installment-schedule.util', () => {
    describe('toIsoDate', () => {
        it('formats a local date as YYYY-MM-DD', () => {
            expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
            expect(toIsoDate(TODAY)).toBe('2026-10-16');
        });
    });

    describe('addMonthsClamped', () => {
        it('clamps Jan 31 to the last day of February', () => {
            expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28');
        });

        it('clamps Jan 31 to Feb 29 in a leap year', () => {
            expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29');
        });

        it('treats YYYY-MM input as day 1', () => {
            expect(addMonthsClamped('2026-03', 0)).toBe('2026-03-01');
            expect(addMonthsClamped('2026-03', 2)).toBe('2026-05-01');
        });

        it('rolls over the year forward and backward', () => {
            expect(addMonthsClamped('2026-11-15', 3)).toBe('2027-02-15');
            expect(addMonthsClamped('2026-12-10', 12)).toBe('2027-12-10');
            expect(addMonthsClamped('2026-01-15', -1)).toBe('2025-12-15');
        });

        it('returns an empty string for an invalid date', () => {
            expect(addMonthsClamped('', 1)).toBe('');
            expect(addMonthsClamped('not a date', 1)).toBe('');
        });
    });

    describe('buildSchedule', () => {
        it('builds monthly payments for a manual plan, keyed m:<n>', () => {
            const schedule = buildSchedule(makeItem({ paymentType: 'manual', startDate: '2026-01-31', installmentsCount: 3, monthlyPayment: 100 }));
            expect(schedule.map(s => s.key)).toEqual(['m:1', 'm:2', 'm:3']);
            expect(schedule.map(s => s.dueDate)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
            expect(schedule.every(s => s.type === 'manual' && s.amount === 100)).toBeTrue();
            expect(schedule.map(s => s.index)).toEqual([1, 2, 3]);
        });

        it('adds the down payment on the start date', () => {
            const schedule = buildSchedule(makeItem({ paymentType: 'manual', startDate: '2026-05-10', downPayment: 2000, installmentsCount: 2, monthlyPayment: 100 }));
            expect(schedule[0]).toEqual(jasmine.objectContaining({ key: 'down', type: 'down', dueDate: '2026-05-10', amount: 2000 }));
            expect(schedule.length).toBe(3);
        });

        it('normalizes a YYYY-MM start date for the down payment', () => {
            const schedule = buildSchedule(makeItem({ paymentType: 'manual', startDate: '2026-05', downPayment: 500, installmentsCount: 1, monthlyPayment: 100 }));
            expect(schedule.find(s => s.key === 'down')!.dueDate).toBe('2026-05-01');
        });

        it('builds loan payments per loan, sorted by due date', () => {
            const item = makeItem({
                paymentType: 'loan',
                loanComponents: [
                    { id: 'a', description: 'A', totalLoanAmount: 0, monthlyPayment: 500, installmentsCount: 2, startDate: '2026-02-05', paidCount: 0 },
                    { id: 'b', description: 'B', totalLoanAmount: 0, monthlyPayment: 200, installmentsCount: 2, startDate: '2026-01-20', paidCount: 0 }
                ]
            });
            const schedule = buildSchedule(item);
            expect(schedule.map(s => s.key)).toEqual(['l:b:1', 'l:a:1', 'l:b:2', 'l:a:2']);
            expect(schedule.find(s => s.key === 'l:a:2')).toEqual(jasmine.objectContaining({ type: 'loan', dueDate: '2026-03-05', amount: 500, index: 2, loanId: 'a', description: 'A' }));
        });

        it('cuts loan payments from the payoff month and adds l:<id>:payoff', () => {
            const item = makeItem({
                paymentType: 'loan',
                loanComponents: [
                    { id: 'a', description: 'A', totalLoanAmount: 0, monthlyPayment: 500, installmentsCount: 12, startDate: '2026-01-10', paidCount: 0, payoffDate: '2026-05', payoffAmount: 3000 }
                ]
            });
            const schedule = buildSchedule(item);
            expect(schedule.map(s => s.key)).toEqual(['l:a:1', 'l:a:2', 'l:a:3', 'l:a:4', 'l:a:payoff']);
            const payoff = schedule[schedule.length - 1];
            expect(payoff).toEqual(jasmine.objectContaining({ dueDate: '2026-05-01', amount: 3000, loanId: 'a' }));
            expect(payoff.index).toBeUndefined();
        });

        it('builds one entry per milestone keyed ms:<id>', () => {
            const item = makeItem({
                paymentType: 'milestone',
                milestones: [
                    { id: 'm2', description: 'Second', percentage: 60, amount: 600, date: '2026-12' },
                    { id: 'm1', description: 'First', percentage: 40, amount: 400, date: '2026-06-15' }
                ]
            });
            const schedule = buildSchedule(item);
            expect(schedule.map(s => s.key)).toEqual(['ms:m1', 'ms:m2']);
            expect(schedule[1]).toEqual(jasmine.objectContaining({ type: 'milestone', dueDate: '2026-12-01', amount: 600, milestoneId: 'm2', description: 'Second' }));
        });

        it('infers the type when paymentType is missing', () => {
            const item = makeItem({ milestones: [{ id: 'm1', description: '', percentage: 100, amount: 1, date: '2026-01' }] });
            expect(buildSchedule(item).map(s => s.key)).toEqual(['ms:m1']);
        });

        it('returns an empty schedule when there is no valid start date', () => {
            expect(buildSchedule(makeItem({ paymentType: 'manual', installmentsCount: 3, monthlyPayment: 100 }))).toEqual([]);
        });
    });

    describe('resolvePayments', () => {
        it('a plan starting in the future has nothing paid', () => {
            const item = makeItem({ paymentType: 'manual', startDate: '2026-11-01', downPayment: 1000, installmentsCount: 3, monthlyPayment: 100 });
            const resolved = resolvePayments(item, TODAY);
            expect(resolved.length).toBe(4);
            expect(resolved.some(p => p.paid)).toBeFalse();
            expect(resolved.every(p => p.paidAmount === 0 && p.source === 'auto' && !p.skipped)).toBeTrue();
        });

        it('a payment due today counts as paid, one due tomorrow does not', () => {
            const dueToday = resolvePayments(makeItem({ paymentType: 'manual', startDate: '2026-10-16', installmentsCount: 1, monthlyPayment: 100 }), TODAY);
            expect(dueToday[0]).toEqual(jasmine.objectContaining({ paid: true, paidDate: '2026-10-16', paidAmount: 100, source: 'auto' }));

            const dueTomorrow = resolvePayments(makeItem({ paymentType: 'manual', startDate: '2026-10-17', installmentsCount: 1, monthlyPayment: 100 }), TODAY);
            expect(dueTomorrow[0]).toEqual(jasmine.objectContaining({ paid: false, paidAmount: 0, source: 'auto' }));
            expect(dueTomorrow[0].paidDate).toBeUndefined();
        });

        it('the down payment is paid only from the start date', () => {
            const item = makeItem({ paymentType: 'manual', startDate: '2026-10-20', downPayment: 5000, installmentsCount: 1, monthlyPayment: 100 });
            expect(resolvePayments(item, TODAY).find(p => p.key === 'down')!.paid).toBeFalse();
            expect(resolvePayments(item, new Date(2026, 9, 20)).find(p => p.key === 'down')!.paid).toBeTrue();
        });

        it('a paid override counts a future payment as paid, with its own date and amount', () => {
            const item = makeItem({
                paymentType: 'manual', startDate: '2026-12-01', installmentsCount: 2, monthlyPayment: 100,
                paymentOverrides: [{ key: 'm:1', status: 'paid', date: '2026-10-01', amount: 80 }]
            });
            const [first, second] = resolvePayments(item, TODAY);
            expect(first).toEqual(jasmine.objectContaining({ key: 'm:1', paid: true, paidDate: '2026-10-01', paidAmount: 80, amount: 100, source: 'manual', skipped: false }));
            expect(second.paid).toBeFalse();
        });

        it('a paid override without amount/date uses the scheduled amount and due date', () => {
            const item = makeItem({
                paymentType: 'manual', startDate: '2026-12-01', installmentsCount: 1, monthlyPayment: 100,
                paymentOverrides: [{ key: 'm:1', status: 'paid' }]
            });
            expect(resolvePayments(item, TODAY)[0]).toEqual(jasmine.objectContaining({ paid: true, paidDate: '2026-12-01', paidAmount: 100 }));
        });

        it('a skipped override after the due date is unpaid and flagged skipped', () => {
            const item = makeItem({
                paymentType: 'manual', startDate: '2026-09-01', installmentsCount: 3, monthlyPayment: 100,
                paymentOverrides: [{ key: 'm:2', status: 'skipped' }]
            });
            const resolved = resolvePayments(item, TODAY);
            expect(resolved.find(p => p.key === 'm:1')!.paid).toBeTrue();
            expect(resolved.find(p => p.key === 'm:2')).toEqual(jasmine.objectContaining({ paid: false, paidAmount: 0, skipped: true, source: 'manual' }));
            expect(resolved.find(p => p.key === 'm:3')).toEqual(jasmine.objectContaining({ paid: false, skipped: false, source: 'auto' }));
        });

        it('a skipped override before the due date is unpaid but not flagged skipped', () => {
            const item = makeItem({
                paymentType: 'manual', startDate: '2026-12-01', installmentsCount: 1, monthlyPayment: 100,
                paymentOverrides: [{ key: 'm:1', status: 'skipped' }]
            });
            expect(resolvePayments(item, TODAY)[0]).toEqual(jasmine.objectContaining({ paid: false, skipped: false }));
        });

        it('adds x: extra payments as paid entries', () => {
            const item = makeItem({
                paymentType: 'manual', startDate: '2026-12-01', installmentsCount: 1, monthlyPayment: 100,
                paymentOverrides: [{ key: 'x:p1', status: 'paid', date: '2026-08-03', amount: 250, description: 'Bonus' }]
            });
            const extra = resolvePayments(item, TODAY).find(p => p.key === 'x:p1')!;
            expect(extra).toEqual(jasmine.objectContaining({
                type: 'extra', dueDate: '2026-08-03', amount: 250, paid: true, paidDate: '2026-08-03', paidAmount: 250, source: 'manual', description: 'Bonus'
            }));
        });

        it('an extra payment without a date is dated today', () => {
            const item = makeItem({ paymentOverrides: [{ key: 'x:p1', status: 'paid', amount: 10 }] });
            expect(resolvePayments(item, TODAY)[0].paidDate).toBe('2026-10-16');
        });

        it('converts legacy milestonePayments into paid overrides', () => {
            const item = makeItem({
                paymentType: 'milestone',
                milestones: [{ id: 'm1', description: 'Kitchen', percentage: 40, amount: 10400, date: '2027-01' }],
                milestonePayments: [
                    { milestoneId: 'm1', date: '2026-09-20', amount: 10400 },
                    { milestoneId: 'gone', date: '2026-08-01', amount: 50, description: 'Old extra' }
                ]
            });
            const resolved = resolvePayments(item, TODAY);
            expect(resolved.find(p => p.key === 'ms:m1')).toEqual(jasmine.objectContaining({ paid: true, paidDate: '2026-09-20', paidAmount: 10400, source: 'manual' }));
            expect(resolved.find(p => p.key === 'x:gone')).toEqual(jasmine.objectContaining({ type: 'extra', paidAmount: 50, description: 'Old extra' }));
        });

        it('does not duplicate a legacy milestone payment when an override for the same key exists', () => {
            const item = makeItem({
                paymentType: 'milestone',
                milestones: [{ id: 'm1', description: '', percentage: 100, amount: 1000, date: '2027-01' }],
                paymentOverrides: [{ key: 'ms:m1', status: 'paid', date: '2026-10-01', amount: 900 }],
                milestonePayments: [{ milestoneId: 'm1', date: '2026-09-20', amount: 1000 }]
            });
            const overrides = getOverrides(item);
            expect(overrides.length).toBe(1);
            expect(overrides[0]).toEqual(jasmine.objectContaining({ key: 'ms:m1', amount: 900 }));
            const resolved = resolvePayments(item, TODAY);
            expect(resolved.length).toBe(1);
            expect(resolved[0].paidAmount).toBe(900);
        });

        it('legacy milestone payments without a milestoneId get unique x:legacy-<i> keys', () => {
            const item = makeItem({
                milestonePayments: [
                    { milestoneId: '', date: '2026-01-01', amount: 1 },
                    { milestoneId: '', date: '2026-02-01', amount: 2 }
                ]
            });
            expect(getOverrides(item).map(o => o.key)).toEqual(['x:legacy-0', 'x:legacy-1']);
        });
    });

    describe('overridesAfterUnpay / overridesAfterReset', () => {
        const item = makeItem({
            paymentType: 'manual', startDate: '2026-09-01', installmentsCount: 4, monthlyPayment: 100,
            paymentOverrides: [
                { key: 'm:4', status: 'paid', date: '2026-10-05' },
                { key: 'x:p1', status: 'paid', date: '2026-10-01', amount: 30 }
            ]
        });

        it('before the due date the override is just removed', () => {
            expect(overridesAfterUnpay(item, 'm:4', TODAY)).toEqual([{ key: 'x:p1', status: 'paid', date: '2026-10-01', amount: 30 }]);
        });

        it('after the due date the payment gets a skipped override', () => {
            const result = overridesAfterUnpay(item, 'm:1', TODAY);
            expect(result).toContain({ key: 'm:1', status: 'skipped' });
            expect(result.length).toBe(3);
        });

        it('a payment due today is also turned into skipped', () => {
            const result = overridesAfterUnpay(item, 'm:2', new Date(2026, 9, 1));
            expect(result).toContain({ key: 'm:2', status: 'skipped' });
        });

        it('unpaying an extra payment just removes it', () => {
            expect(overridesAfterUnpay(item, 'x:p1', TODAY).map(o => o.key)).toEqual(['m:4']);
        });

        it('unpay also converts legacy milestone payments', () => {
            const ms = makeItem({
                paymentType: 'milestone',
                milestones: [{ id: 'm1', description: '', percentage: 100, amount: 1000, date: '2026-03' }],
                milestonePayments: [{ milestoneId: 'm1', date: '2026-03-02', amount: 1000 }]
            });
            expect(overridesAfterUnpay(ms, 'ms:m1', TODAY)).toEqual([{ key: 'ms:m1', status: 'skipped' }]);
        });

        it('reset removes the override so the date decides again', () => {
            const skipped = makeItem({ ...item, paymentOverrides: [{ key: 'm:1', status: 'skipped' }] });
            const result = overridesAfterReset(skipped, 'm:1');
            expect(result).toEqual([]);
            expect(resolvePayments({ ...skipped, paymentOverrides: result }, TODAY)[0].paid).toBeTrue();
        });
    });
});
