/**
 * Installment payment schedule + progress (pure functions, no I/O).
 *
 * Rule: a scheduled payment counts as paid automatically once its due date arrives
 * (dueDate <= today, compared as local 'YYYY-MM-DD' strings). `installment.paymentOverrides`
 * corrects single payments:
 *   { key, status: 'paid' | 'skipped', date?, amount?, description? }
 *   - status 'skipped' -> not paid (even when the due date has passed)
 *   - status 'paid'    -> paid (also before the due date); amount = override.amount ?? scheduled amount
 *   - key 'x:<id>' + status 'paid' -> an extra ad-hoc payment (not part of the schedule)
 *
 * Schedule keys:
 *   down                      down payment (downPayment > 0), due on installment.startDate
 *   m:<n>                     manual plan, n = 1..installmentsCount, amount monthlyPayment
 *   l:<loanId>:<n>            loan component, n = 1..installmentsCount, amount loan.monthlyPayment
 *   l:<loanId>:payoff         early payoff (loan.payoffDate + loan.payoffAmount) replacing the payments
 *                             whose due month is on/after the payoff month
 *   ms:<milestoneId>          milestone, amount milestone.amount, due on milestone.date
 *
 * Legacy: `milestonePayments` (with milestoneId) count as a 'paid' override for ms:<milestoneId>
 * when that key has no override; entries that match no milestone become extra payments.
 * Legacy `payments`, `manualPaidCount` and loan `paidCount` are ignored.
 */

const pad = (n) => String(n).padStart(2, '0');

/** Local date -> 'YYYY-MM-DD'. Strings are taken as-is (first 10 chars). */
function toDateStr(today = new Date()) {
    if (typeof today === 'string') return today.slice(0, 10);
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
}

/** 'YYYY-MM' (day 1) or 'YYYY-MM-DD[...]' -> { y, m, d }, or null when unparseable. */
function parseDate(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(value);
    if (!match) return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = match[3] ? Number(match[3]) : 1;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { y, m, d };
}

const formatDate = ({ y, m, d }) => `${y}-${pad(m)}-${pad(d)}`;

/** Adds `months` keeping the day of month, clamped to the target month's last day (Jan 31 + 1 -> Feb 28/29). */
function addMonthsClamped(start, months) {
    const index = (start.m - 1) + months;
    const y = start.y + Math.floor(index / 12);
    const m = (((index % 12) + 12) % 12) + 1;
    const lastDay = new Date(y, m, 0).getDate();
    return { y, m, d: Math.min(start.d, lastDay) };
}

/** Same fallback the client uses for old records without paymentType. */
function resolvePaymentType(inst) {
    if (inst?.paymentType === 'manual' || inst?.paymentType === 'loan' || inst?.paymentType === 'milestone') {
        return inst.paymentType;
    }
    if (inst?.loanComponents?.length) return 'loan';
    if (inst?.milestones?.length) return 'milestone';
    return 'manual';
}

const toAmount = (v) => Number(v) || 0;
const toCount = (v) => Math.max(0, Math.trunc(Number(v) || 0));

/** Monthly series: payment n (1-based) due on start + (n-1) months. */
function monthlySeries(startDate, count) {
    const start = parseDate(startDate);
    const dates = [];
    for (let n = 1; n <= count; n++) dates.push(start ? formatDate(addMonthsClamped(start, n - 1)) : null);
    return dates;
}

/**
 * Scheduled payments of an installment, sorted by due date (entries without a date last).
 * Each entry: { key, kind: 'down'|'manual'|'loan'|'payoff'|'milestone', dueDate (YYYY-MM-DD or null), amount, ... }
 */
function buildSchedule(inst = {}) {
    const entries = [];
    const type = resolvePaymentType(inst);

    if (toAmount(inst.downPayment) > 0) {
        const start = parseDate(inst.startDate);
        entries.push({ key: 'down', kind: 'down', dueDate: start ? formatDate(start) : null, amount: toAmount(inst.downPayment) });
    }

    if (type === 'manual') {
        monthlySeries(inst.startDate, toCount(inst.installmentsCount)).forEach((dueDate, i) => {
            entries.push({ key: `m:${i + 1}`, kind: 'manual', index: i + 1, dueDate, amount: toAmount(inst.monthlyPayment) });
        });
    } else if (type === 'loan') {
        for (const loan of inst.loanComponents || []) {
            const loanId = loan?.id;
            const payoff = parseDate(loan?.payoffDate);
            const payoffMonth = payoff ? `${payoff.y}-${pad(payoff.m)}` : null;
            monthlySeries(loan?.startDate, toCount(loan?.installmentsCount)).forEach((dueDate, i) => {
                if (payoffMonth && (!dueDate || dueDate.slice(0, 7) >= payoffMonth)) return;
                entries.push({ key: `l:${loanId}:${i + 1}`, kind: 'loan', loanId, index: i + 1, dueDate, amount: toAmount(loan?.monthlyPayment) });
            });
            if (payoff) {
                entries.push({ key: `l:${loanId}:payoff`, kind: 'payoff', loanId, dueDate: formatDate(payoff), amount: toAmount(loan?.payoffAmount) });
            }
        }
    } else {
        for (const ms of inst.milestones || []) {
            const due = parseDate(ms?.date);
            entries.push({
                key: `ms:${ms?.id}`, kind: 'milestone', milestoneId: ms?.id, description: ms?.description,
                dueDate: due ? formatDate(due) : null, amount: toAmount(ms?.amount)
            });
        }
    }

    // stable sort: by due date, undated entries at the end
    return entries
        .map((e, i) => ({ e, i }))
        .sort((a, b) => {
            if (a.e.dueDate === b.e.dueDate) return a.i - b.i;
            if (!a.e.dueDate) return 1;
            if (!b.e.dueDate) return -1;
            return a.e.dueDate < b.e.dueDate ? -1 : 1;
        })
        .map(({ e }) => e);
}

/**
 * Effective overrides by key: explicit paymentOverrides (last one per key wins) plus legacy
 * milestonePayments, which never replace an explicit override.
 * Returns { byKey: Map, legacyExtras: [] }.
 */
function collectOverrides(inst, scheduleKeys) {
    const byKey = new Map();
    for (const o of Array.isArray(inst.paymentOverrides) ? inst.paymentOverrides : []) {
        if (o && typeof o.key === 'string' && (o.status === 'paid' || o.status === 'skipped')) byKey.set(o.key, o);
    }

    const legacyExtras = [];
    const legacy = new Map();
    (Array.isArray(inst.milestonePayments) ? inst.milestonePayments : []).forEach((p, i) => {
        if (!p) return;
        const key = `ms:${p.milestoneId}`;
        if (p.milestoneId != null && scheduleKeys.has(key)) {
            if (byKey.has(key)) return;
            // several legacy payments for one milestone (partial payments) add up
            const prev = legacy.get(key);
            legacy.set(key, {
                key, status: 'paid',
                date: prev?.date ?? p.date,
                amount: (prev?.amount ?? 0) + toAmount(p.amount),
                description: prev?.description ?? p.description
            });
        } else {
            legacyExtras.push({ key: `legacy:${i + 1}`, date: p.date ?? null, amount: toAmount(p.amount), description: p.description });
        }
    });
    for (const [key, o] of legacy) byKey.set(key, o);

    return { byKey, legacyExtras };
}

/**
 * Progress of an installment on `today` (Date or 'YYYY-MM-DD'; default: now, local date).
 * Returns {
 *   entries: schedule entries + { paid, status: 'paid'|'skipped'|'upcoming', paidAmount, paidDate, overridden },
 *   extraPayments: [{ key, date, amount, description }],
 *   scheduledTotal, paidAmount (scheduled paid + extras), remainingAmount = max(0, scheduledTotal - paidAmount),
 *   paidCount, remainingCount (scheduled entries only), totalCount,
 *   nextPayment (earliest unpaid entry or null), isCompleted,
 *   paidMilestoneIds: string[]
 * }
 */
function getPaymentProgress(inst = {}, today = new Date()) {
    const todayStr = toDateStr(today);
    const schedule = buildSchedule(inst);
    const { byKey, legacyExtras } = collectOverrides(inst, new Set(schedule.map((e) => e.key)));

    const entries = schedule.map((e) => {
        const o = byKey.get(e.key);
        if (o?.status === 'skipped') {
            return { ...e, paid: false, status: 'skipped', paidAmount: 0, paidDate: null, overridden: true };
        }
        if (o?.status === 'paid') {
            const amount = o.amount === undefined || o.amount === null ? e.amount : toAmount(o.amount);
            return { ...e, paid: true, status: 'paid', paidAmount: amount, paidDate: o.date ?? e.dueDate, overridden: true };
        }
        const due = !!e.dueDate && e.dueDate <= todayStr;
        return due
            ? { ...e, paid: true, status: 'paid', paidAmount: e.amount, paidDate: e.dueDate, overridden: false }
            : { ...e, paid: false, status: 'upcoming', paidAmount: 0, paidDate: null, overridden: false };
    });

    const extraPayments = [];
    for (const o of byKey.values()) {
        if (o.key.startsWith('x:') && o.status === 'paid') {
            extraPayments.push({ key: o.key, date: o.date ?? null, amount: toAmount(o.amount), description: o.description });
        }
    }
    extraPayments.push(...legacyExtras);

    const scheduledTotal = entries.reduce((s, e) => s + e.amount, 0);
    const paidAmount = entries.reduce((s, e) => s + e.paidAmount, 0) + extraPayments.reduce((s, x) => s + x.amount, 0);
    const paidCount = entries.filter((e) => e.paid).length;
    const unpaid = entries.filter((e) => !e.paid);

    return {
        entries,
        extraPayments,
        scheduledTotal,
        paidAmount,
        remainingAmount: Math.max(0, scheduledTotal - paidAmount),
        paidCount,
        remainingCount: unpaid.length,
        totalCount: entries.length,
        nextPayment: unpaid[0] ?? null,
        isCompleted: entries.length > 0 && unpaid.length === 0,
        paidMilestoneIds: entries.filter((e) => e.kind === 'milestone' && e.paid).map((e) => e.milestoneId)
    };
}

module.exports = {
    buildSchedule,
    getPaymentProgress,
    resolvePaymentType,
    addMonthsClamped,
    parseDate,
    toDateStr
};
