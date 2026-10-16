import { Installment, PaymentOverride } from '../models/installment.model';

/**
 * לוח התשלומים של פריסה: כל תשלום נחשב כמשולם אוטומטית כשמגיע מועד החיוב שלו.
 * תיקונים ידניים (paymentOverrides) גוברים על החישוב לפי תאריך:
 *  - 'paid'    = שולם (גם לפני המועד, או בסכום/תאריך אחר)
 *  - 'skipped' = לא שולם למרות שהמועד עבר (בוטל / נדחה)
 *
 * מפתחות: 'down' (מקדמה), 'm:<n>' (תשלום חודשי), 'l:<loanId>:<n>' / 'l:<loanId>:payoff' (הלוואה),
 * 'ms:<milestoneId>' (פעימה), 'x:<id>' (תשלום נוסף שלא בלוח).
 */
export type ScheduledPaymentType = 'down' | 'manual' | 'loan' | 'milestone' | 'extra';

export interface ScheduledPayment {
    key: string;
    type: ScheduledPaymentType;
    dueDate: string;   // YYYY-MM-DD
    amount: number;
    index?: number;    // מספר התשלום (1..n) בתשלומים חודשיים והלוואות
    loanId?: string;
    milestoneId?: string;
    description?: string;
}

export interface ResolvedPayment extends ScheduledPayment {
    paid: boolean;
    paidDate?: string;      // מתי שולם בפועל (או מועד החיוב כשהסימון אוטומטי)
    paidAmount: number;     // 0 כשלא שולם
    source: 'auto' | 'manual';
    skipped: boolean;       // המועד עבר אבל סומן "לא שולם"
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** תאריך מקומי בפורמט YYYY-MM-DD */
export function toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseParts(dateStr: string | undefined): { y: number, m: number, d: number } | null {
    const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?/.exec((dateStr || '').trim());
    if (!match) return null;
    return { y: Number(match[1]), m: Number(match[2]), d: match[3] ? Number(match[3]) : 1 };
}

/** תאריך ההתחלה + n חודשים, באותו יום בחודש (נחתך ליום האחרון בחודשים קצרים) */
export function addMonthsClamped(dateStr: string, months: number): string {
    const p = parseParts(dateStr);
    if (!p) return '';
    const monthIndex = p.m - 1 + months;
    const y = p.y + Math.floor(monthIndex / 12);
    const m = ((monthIndex % 12) + 12) % 12;
    const lastDay = Math.round((Date.UTC(y, m + 1, 1) - Date.UTC(y, m, 1)) / DAY_MS);
    const d = Math.min(p.d, lastDay);
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function normalizeDate(dateStr: string | undefined): string {
    return dateStr ? addMonthsClamped(dateStr, 0) : '';
}

export function resolvePaymentType(item: Installment): 'manual' | 'loan' | 'milestone' {
    return item.paymentType || (item.loanComponents?.length ? 'loan' : (item.milestones?.length ? 'milestone' : 'manual'));
}

/** כל התשלומים המתוכננים של הפריסה, ממוינים לפי מועד */
export function buildSchedule(item: Installment): ScheduledPayment[] {
    const schedule: ScheduledPayment[] = [];
    const downPayment = Number(item.downPayment) || 0;
    if (downPayment > 0 && parseParts(item.startDate)) {
        schedule.push({ key: 'down', type: 'down', dueDate: normalizeDate(item.startDate), amount: downPayment });
    }

    const type = resolvePaymentType(item);
    if (type === 'loan') {
        for (const loan of item.loanComponents || []) {
            if (!parseParts(loan.startDate)) continue;
            const count = Math.max(0, Math.trunc(Number(loan.installmentsCount) || 0));
            const payoff = parseParts(loan.payoffDate);
            const payoffMonth = payoff ? payoff.y * 12 + payoff.m : Infinity;
            for (let n = 1; n <= count; n++) {
                const dueDate = addMonthsClamped(loan.startDate, n - 1);
                const due = parseParts(dueDate)!;
                if (due.y * 12 + due.m >= payoffMonth) break;
                schedule.push({ key: `l:${loan.id}:${n}`, type: 'loan', dueDate, amount: Number(loan.monthlyPayment) || 0, index: n, loanId: loan.id, description: loan.description });
            }
            if (payoff) {
                schedule.push({ key: `l:${loan.id}:payoff`, type: 'loan', dueDate: normalizeDate(loan.payoffDate), amount: Number(loan.payoffAmount) || 0, loanId: loan.id, description: loan.description });
            }
        }
    } else if (type === 'milestone') {
        for (const milestone of item.milestones || []) {
            if (!parseParts(milestone.date)) continue;
            schedule.push({ key: `ms:${milestone.id}`, type: 'milestone', dueDate: normalizeDate(milestone.date), amount: Number(milestone.amount) || 0, milestoneId: milestone.id, description: milestone.description });
        }
    } else if (parseParts(item.startDate)) {
        const count = Math.max(0, Math.trunc(Number(item.installmentsCount) || 0));
        for (let n = 1; n <= count; n++) {
            schedule.push({ key: `m:${n}`, type: 'manual', dueDate: addMonthsClamped(item.startDate, n - 1), amount: Number(item.monthlyPayment) || 0, index: n });
        }
    }

    return schedule.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** התיקונים של הפריסה, כולל המרה של תשלומי פעימות מהמודל הישן (milestonePayments) */
export function getOverrides(item: Installment): PaymentOverride[] {
    const overrides = [...(item.paymentOverrides || [])];
    const keys = new Set(overrides.map(o => o.key));
    const milestoneIds = new Set((item.milestones || []).map(m => m.id));
    (item.milestonePayments || []).forEach((mp, i) => {
        const key = mp.milestoneId && milestoneIds.has(mp.milestoneId) ? `ms:${mp.milestoneId}` : `x:${mp.milestoneId || `legacy-${i}`}`;
        if (keys.has(key)) return;
        keys.add(key);
        overrides.push({ key, status: 'paid', date: mp.date, amount: Number(mp.amount) || 0, description: mp.description });
    });
    return overrides;
}

/** מצב כל תשלום נכון ל-today: שולם אוטומטית / סומן ידנית / לא שולם */
export function resolvePayments(item: Installment, today: Date = new Date()): ResolvedPayment[] {
    const todayStr = toIsoDate(today);
    const overrides = new Map(getOverrides(item).map(o => [o.key, o]));

    const resolved: ResolvedPayment[] = buildSchedule(item).map(entry => {
        const override = overrides.get(entry.key);
        if (override?.status === 'paid') {
            const amount = override.amount ?? entry.amount;
            return { ...entry, paid: true, paidDate: override.date || entry.dueDate, paidAmount: amount, source: 'manual', skipped: false };
        }
        if (override?.status === 'skipped') {
            return { ...entry, paid: false, paidAmount: 0, source: 'manual', skipped: entry.dueDate <= todayStr };
        }
        const paid = entry.dueDate <= todayStr;
        return { ...entry, paid, paidDate: paid ? entry.dueDate : undefined, paidAmount: paid ? entry.amount : 0, source: 'auto', skipped: false };
    });

    // תשלומים נוספים שלא בלוח
    for (const override of overrides.values()) {
        if (!override.key.startsWith('x:') || override.status !== 'paid') continue;
        const date = normalizeDate(override.date) || todayStr;
        const amount = Number(override.amount) || 0;
        resolved.push({ key: override.key, type: 'extra', dueDate: date, amount, description: override.description, paid: true, paidDate: date, paidAmount: amount, source: 'manual', skipped: false });
    }

    return resolved;
}

/** התיקון שצריך לשמור כדי שתשלום ייחשב "לא שולם": לפני המועד מספיק להסיר תיקון, אחרי המועד צריך 'skipped' */
export function overridesAfterUnpay(item: Installment, key: string, today: Date = new Date()): PaymentOverride[] {
    const rest = getOverrides(item).filter(o => o.key !== key);
    const entry = buildSchedule(item).find(e => e.key === key);
    if (entry && entry.dueDate <= toIsoDate(today)) {
        rest.push({ key, status: 'skipped' });
    }
    return rest;
}

export function overridesAfterPay(item: Installment, override: PaymentOverride): PaymentOverride[] {
    return [...getOverrides(item).filter(o => o.key !== override.key), override];
}

/** מחזיר את התשלום לחישוב האוטומטי לפי תאריך */
export function overridesAfterReset(item: Installment, key: string): PaymentOverride[] {
    return getOverrides(item).filter(o => o.key !== key);
}
